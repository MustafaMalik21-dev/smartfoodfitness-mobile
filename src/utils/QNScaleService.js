/**
 * Smart Scale BLE service — FFE0 family.
 *
 * Service FFE0
 *   FFE1 (notify)  — measurement packets from scale
 *                    0x12 = idle/replay (cached weight, no session)
 *                    0x10 = live measurement (connected session)
 *                    0x1C/0x1D = live measurement (alternate firmware)
 *   FFE2 (indicate)— scale acknowledgements; subscribe via monitorCharacteristicForService
 *   FFE3 (write-no-resp) — CMD_PROFILE (0x13, 9 bytes) + CMD_HEARTBEAT (0x1F, 5 bytes)
 *   FFE4 (write-no-resp) — CMD_DEVICE  (0x20, 8 bytes) + CMD_SESSION (0x22, 4 bytes)
 *
 * Startup sequence (all write-without-response):
 *   1. CMD_PROFILE  → FFE3: [0x13, unit, age, gender, 0x10, height_cm, age, 0x00, chk]
 *   2. CMD_DEVICE   → FFE4: [0x20, 0x08, age, b3, b4, b5, b6, chk]  (b3-b6 = fixed placeholder)
 *   3. CMD_SESSION  → FFE4: [0x22, 0x04, age, chk]
 *   ~30 s later, and every 30 s:
 *   4. CMD_HEARTBEAT→ FFE3: [0x1F, 0x05, age, 0x10, chk]
 *
 *   checksum = (sum of all bytes except last) & 0xFF
 *   unit = 0x09 for kg
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

let BleManager;
try {
  const blePlx = require("react-native-ble-plx");
  BleManager = blePlx.BleManager;
  console.log("[Scale] BLE loaded OK");
} catch (e) {
  console.log("[Scale] BLE not available:", e?.message);
}

export const BLE_AVAILABLE = !!BleManager;

const SVC              = "0000FFE0-0000-1000-8000-00805F9B34FB";
const CHAR_NOTIFY      = "0000FFE1-0000-1000-8000-00805F9B34FB";
// FFE2 = indicate characteristic (CCCD write 0x02 0x00).
// Scale sends acknowledgements here — not used for sending commands.
const CHAR_IND         = "0000FFE2-0000-1000-8000-00805F9B34FB";
// FFE3 = primary command channel (write-without-response).
// Carries 0x13 user-profile and 0x1F heartbeat commands.
const CHAR_CMD         = "0000FFE3-0000-1000-8000-00805F9B34FB";
// FFE4 = secondary command channel (write-without-response).
// Carries 0x20 device-info and 0x22 session commands.
const CHAR_CMD2        = "0000FFE4-0000-1000-8000-00805F9B34FB";

// ── Smart Scale BLE protocol ──────────────────────────────────────────────────
//
// Three commands sent in sequence, all write-without-response:
//
//   CMD_PROFILE  → FFE3 (9 bytes):
//     [0x13, unit, age, gender, 0x10, height_cm, age, 0x00, checksum]
//     unit = 0x09 for kg
//     gender: 0x01 = female, 0x00 = male
//     height: 1 byte, cm (170 = 0xAA)
//     age repeated at byte[2] and byte[6] (protocol quirk)
//     checksum = (sum of bytes 0-7) & 0xFF
//
//   CMD_DEVICE   → FFE4 (8 bytes):
//     [0x20, 0x08, age, b3, b4, b5, b6, checksum]
//     bytes 3-6 are device-specific — sent as a fixed placeholder.
//
//   CMD_SESSION  → FFE4 (4 bytes):
//     [0x22, 0x04, age, checksum]
//
// The scale also uses a challenge-response: it replies with 0x21 on FFE2
// containing its stored profile age, which must be echoed back in the above
// commands (see two-phase init logic below).

const UNIT_KG = 0x09;

// Default profile: 170 cm, 25 yo, female.
// Checksum: 0x13+0x09+0x19+0x01+0x10+0xAA+0x19+0x00 = 0x109 → 0x09
const CMD_PROFILE_DEFAULT   = [0x13, 0x09, 0x19, 0x01, 0x10, 0xAA, 0x19, 0x00, 0x09];
// Device-info command (bytes 3-6 are fixed placeholder values).
const CMD_DEVICE            = [0x20, 0x08, 0x19, 0xF2, 0x68, 0xB4, 0x31, 0x7C];
// Session command (age byte at position 2 is substituted per user profile).
const CMD_SESSION_DEFAULT   = [0x22, 0x04, 0x19, 0x3F]; // chk = (0x22+0x04+0x19)&0xFF = 0x3F
// Heartbeat sent to FFE3 every 30 s to keep the session alive.
const CMD_HEARTBEAT_DEFAULT = [0x1F, 0x05, 0x19, 0x10, 0x4D]; // chk = (0x1F+0x05+0x19+0x10)&0xFF = 0x4D

const PAIRED_KEY  = "sff_ble_scale_v1";
const NAME_HINTS  = ["QN-", "CS20", "Kamtron", "KAMTRON", "FeelFit", "feelfit", "Renpho", "RENPHO", "Scale", "scale"];

// ── User-profile commands ─────────────────────────────────────────────────────
// Returns an array of four byte arrays to send in sequence:
//   [0] CMD_PROFILE   → FFE3  (9 bytes)
//   [1] CMD_DEVICE    → FFE4  (8 bytes)
//   [2] CMD_SESSION   → FFE4  (4 bytes)
//   [3] CMD_HEARTBEAT → FFE3  (5 bytes, sent every 30 s after initial sequence)
export function buildUserCommands(heightCm, age, gender) {
  const h = Math.max(100, Math.min(255, Math.round(heightCm || 170)));
  const a = Math.max(10,  Math.min(99,  Math.round(age     || 25)));
  // Gender: 0x01 = female confirmed from capture; 0x00 = male assumed (unverified).
  const g = (gender || "").toLowerCase().startsWith("f") ? 0x01 : 0x00;

  // CMD_PROFILE: [0x13, unit, age, gender, 0x10, height, age, 0x00, checksum]
  const profileChk   = (0x13 + UNIT_KG + a + g + 0x10 + h + a + 0x00) & 0xFF;
  const cmdProfile   = [0x13, UNIT_KG, a, g, 0x10, h, a, 0x00, profileChk];

  // CMD_DEVICE: age at byte[2], rest are fixed from capture (device placeholder bytes).
  const deviceChk    = (0x20 + 0x08 + a + 0xF2 + 0x68 + 0xB4 + 0x31) & 0xFF;
  const cmdDevice    = [0x20, 0x08, a, 0xF2, 0x68, 0xB4, 0x31, deviceChk];

  // CMD_SESSION: [0x22, 0x04, age, checksum]
  const sessionChk   = (0x22 + 0x04 + a) & 0xFF;
  const cmdSession   = [0x22, 0x04, a, sessionChk];

  // CMD_HEARTBEAT: [0x1F, 0x05, age, 0x10, checksum]
  const heartbeatChk = (0x1F + 0x05 + a + 0x10) & 0xFF;
  const cmdHeartbeat = [0x1F, 0x05, a, 0x10, heartbeatChk];

  return [cmdProfile, cmdDevice, cmdSession, cmdHeartbeat];
}

// Legacy single-command export (used by screen's re-send hook).
// Returns just the profile command as a flat byte array.
export function buildUserCommand(heightCm, age, gender) {
  return buildUserCommands(heightCm, age, gender)[0];
}

let _manager = null;
function mgr() {
  if (!_manager && BleManager) _manager = new BleManager();
  return _manager;
}

// ── Paired device persistence ─────────────────────────────────────────────────

export async function savePairedDevice(device) {
  try {
    await AsyncStorage.setItem(PAIRED_KEY, JSON.stringify({
      id:   device.id,
      name: device.name || device.localName || "Smart Scale",
    }));
  } catch {}
}

export async function getPairedDevice() {
  try {
    const raw = await AsyncStorage.getItem(PAIRED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function clearPairedDevice() {
  try { await AsyncStorage.removeItem(PAIRED_KEY); } catch {}
}

// ── Base64 helpers ────────────────────────────────────────────────────────────

function bytesToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Packet parsing ────────────────────────────────────────────────────────────

function parsePacket(base64) {
  try {
    const bytes = base64ToBytes(base64);
    if (bytes.length < 5) return null;

    const b0 = bytes[0] & 0xff;
    let hardwareStable, rawWeight, impedance = null;

    if (b0 === 0x1C || b0 === 0x1D) {
      // Alternate firmware: stable at byte[2], weight at bytes[3,4], impedance at bytes[5,6]
      hardwareStable = (bytes[2] & 0xff) === 0x01;
      rawWeight      = ((bytes[3] & 0xff) << 8) | (bytes[4] & 0xff);
      if (hardwareStable && bytes.length > 6) {
        const ri = ((bytes[5] & 0xff) << 8) | (bytes[6] & 0xff);
        if (ri > 50 && ri < 5000) impedance = ri;
      }
    } else if (b0 === 0x10) {
      // Connected-session live measurement packet (confirmed from live capture):
      //   byte[0] = 0x10  (type)
      //   byte[1] = 0x0b  (length = 11)
      //   byte[2] = stored age (NOT a stability flag — same value as profile age)
      //   bytes[3,4] = weight big-endian (raw / 100 = kg)
      //   byte[5] = hardware stable flag (0x01 = confirmed final reading)
      //   bytes[8,9] = impedance in Ω when stable (0 when still settling)
      if (bytes.length < 6) return null;
      rawWeight      = ((bytes[3] & 0xff) << 8) | (bytes[4] & 0xff);
      hardwareStable = (bytes[5] & 0xff) === 0x01;
      if (hardwareStable && bytes.length >= 10) {
        const ri = ((bytes[8] & 0xff) << 8) | (bytes[9] & 0xff);
        if (ri > 50 && ri < 5000) impedance = ri;
      }
    } else {
      // Unknown/future packet types — best-effort parse
      if (bytes.length < 10) return null;
      hardwareStable = (bytes[2] & 0xff) === 0x01;
      rawWeight      = ((bytes[3] & 0xff) << 8) | (bytes[4] & 0xff);
    }

    const weight = rawWeight / 100;
    if (weight <= 0 || weight > 350) return null;
    return { weight, hardwareStable, impedance, packetType: b0 };
  } catch { return null; }
}

// ── Software stability ────────────────────────────────────────────────────────

function makeStabilityTracker() {
  const win = [];
  return (w) => {
    win.push(w);
    if (win.length > 5) win.shift();
    if (win.length < 5) return false;
    return (Math.max(...win) - Math.min(...win)) <= 0.15;
  };
}

// ── Device matching ───────────────────────────────────────────────────────────

export function isQNDevice(device) {
  const name = (device.name || device.localName || "").toLowerCase();
  if (NAME_HINTS.some(h => name.includes(h.toLowerCase()))) return true;
  if (device.serviceUUIDs?.some(u => u.toUpperCase().includes("FFE0"))) return true;
  return false;
}

// ── BT state helper ───────────────────────────────────────────────────────────

function waitForPoweredOn(m, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      console.log("[Scale] waitForPoweredOn TIMEOUT");
      try { sub?.remove(); } catch {}
      resolve(false);
    }, timeoutMs);

    const sub = m.onStateChange((s) => {
      console.log("[Scale] BT state:", s);
      if (resolved) return;
      if (s === "PoweredOn") {
        resolved = true; clearTimeout(timer); try { sub?.remove(); } catch {} resolve(true);
      } else if (s === "PoweredOff" || s === "Unauthorized" || s === "Unsupported") {
        resolved = true; clearTimeout(timer); try { sub?.remove(); } catch {} resolve(false);
      }
    }, true);
  });
}

// ── General scan (for pairing UI) ─────────────────────────────────────────────

export async function scanForDevices(onDevice, onError) {
  if (!BLE_AVAILABLE) { onError("BLE not available."); return () => {}; }
  const m = mgr();
  const powered = await waitForPoweredOn(m);
  if (!powered) { onError("Bluetooth is off."); return () => {}; }

  m.startDeviceScan([SVC], { allowDuplicates: false }, (err, device) => {
    if (err) { onError(err.reason || err.message || "Scan error"); return; }
    if (device && isQNDevice(device)) onDevice(device);
  });

  setTimeout(() => {
    try {
      m.startDeviceScan(null, { allowDuplicates: false }, (err, device) => {
        if (err || !device) return;
        if (isQNDevice(device)) onDevice(device);
      });
    } catch {}
  }, 3000);

  return () => { try { m.stopDeviceScan(); } catch {} };
}

// ── Connect & measure ─────────────────────────────────────────────────────────
//
// onConnected()          — called when GATT is up and init cmd sent.
// onWriteReady(writeFn)  — called with an async function writeFn(bytes[])
//                          that the screen can call later to re-send the init
//                          command (e.g. once the user profile finishes loading).
//
export function connectAndMeasure(
  deviceOrId,
  onMeasurement,
  onError,
  userCmd    = null,
  onConnected = null,
  onWriteReady = null,
) {
  console.log("[Scale] connectAndMeasure called, BLE_AVAILABLE:", BLE_AVAILABLE,
    "id:", deviceOrId?.id || deviceOrId);

  if (!BLE_AVAILABLE) { onError("BLE not available."); return () => {}; }
  const m = mgr();

  let connected      = null;
  let sub            = null;
  let subInd         = null; // FFE2 indication subscription
  let cancelled      = false;
  let retryDelay     = null;
  let svcUUID        = SVC;
  let heartbeatTimer = null; // outer scope so cleanup can always clear it

  const deviceId     = typeof deviceOrId === "string" ? deviceOrId : deviceOrId?.id;
  const isScannedDev = typeof deviceOrId?.connect === "function";

  // ── Write helpers ─────────────────────────────────────────────────────────────
  // writeTo: send one write-without-response to a specific characteristic.
  async function writeTo(charUUID, cmd) {
    if (!connected || cancelled) return;
    const b64 = bytesToBase64(cmd);
    const hex = Array.from(cmd).map(b => b.toString(16).padStart(2,"0")).join(" ");
    console.log("[Scale] →", charUUID.slice(-4), hex);
    try {
      await connected.writeCharacteristicWithoutResponseForService(svcUUID, charUUID, b64);
      console.log("[Scale] ✓", charUUID.slice(-4));
    } catch (e) {
      console.log("[Scale] ✗", charUUID.slice(-4), e?.message);
    }
  }

  // scheduleHeartbeat: sends CMD_HEARTBEAT to FFE3 to keep the session alive.
  // First heartbeat fires after 5 s so the scale doesn't idle-timeout while the
  // user walks over to step on it.  All subsequent beats fire every 30 s.
  function scheduleHeartbeat(hbCmd, delay = 5000) {
    if (cancelled) return;
    return setTimeout(async () => {
      if (cancelled) return;
      console.log("[Scale] sending heartbeat");
      await writeTo(CHAR_CMD, hbCmd);
      heartbeatTimer = scheduleHeartbeat(hbCmd, 30000);
    }, delay);
  }

  // writeCmd: kept for the onWriteReady / profile re-send hook used by the screen.
  async function writeCmd(cmd) {
    await writeTo(CHAR_CMD, cmd);
  }

  // ── async work ──────────────────────────────────────────────────────────────
  async function run() {
    console.log("[Scale] run() started");

    const powered = await waitForPoweredOn(m, 8000);
    if (cancelled) return;
    if (!powered) { onError("Bluetooth is off."); return; }

    try {
      try { m.stopDeviceScan(); } catch {}

      // Connection loop — retries until scale wakes up and accepts the connection
      let attempt = 0;
      while (!cancelled) {
        attempt++;
        console.log(`[Scale] attempt ${attempt} — connecting to ${deviceId}`);
        try {
          const connectPromise = isScannedDev
            ? deviceOrId.connect({ autoConnect: false })
            : m.connectToDevice(deviceId, { autoConnect: false });

          connected = await Promise.race([
            connectPromise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("timed out after 10 s")), 10000)),
          ]);
          console.log("[Scale] GATT connected ✓ attempt:", attempt);
          break;
        } catch (e) {
          connected = null;
          if (cancelled) return;
          console.log(`[Scale] attempt ${attempt} failed: ${e?.message}`);
          if (isScannedDev) throw e; // fresh scan device — real error, don't loop
          console.log("[Scale] retrying in 3 s…");
          await new Promise(r => { retryDelay = setTimeout(r, 3000); });
          retryDelay = null;
          if (cancelled) return;
        }
      }

      if (cancelled || !connected) return;

      // Service discovery
      console.log("[Scale] discovering services…");
      await connected.discoverAllServicesAndCharacteristics();
      if (cancelled) { try { connected.cancelConnection(); } catch {} return; }

      // ── Resolve notify UUID from GATT table ──────────────────────────────────
      // We only need the notify char (FFE1) — all write chars are hardcoded as
      // CHAR_CMD (FFE3) and CHAR_CMD2 (FFE4) per the confirmed protocol.
      let notifyUUID = CHAR_NOTIFY;
      try {
        const services = await connected.services();
        console.log("[Scale] services:", services.map(s => s.uuid));
        const s = services.find(x => x.uuid.toUpperCase().includes("FFE0"));
        if (s) {
          svcUUID = s.uuid;
          const chars = await s.characteristics();
          console.log("[Scale] characteristics:");
          chars.forEach(c => console.log(`  ${c.uuid} notify=${c.isNotifiable} write=${c.isWritable} writeNoResp=${c.isWritableWithoutResponse}`));
          const notifyChar = chars.find(x => x.uuid.toUpperCase().includes("FFE1") && x.isNotifiable)
                          || chars.find(x => x.isNotifiable);
          if (notifyChar) {
            notifyUUID = notifyChar.uuid;
            console.log("[Scale] notify UUID resolved:", notifyUUID);
          }
        } else {
          console.log("[Scale] WARNING: FFE0 service not found — using fallback UUIDs");
        }
      } catch (e) {
        console.log("[Scale] UUID resolve error:", e?.message);
      }

      console.log("[Scale] final UUIDs → svc:", svcUUID, "notify:", notifyUUID);

      if (cancelled) { try { connected.cancelConnection(); } catch {} return; }

      // ── Build init commands ───────────────────────────────────────────────────
      // userCmd may be: (a) a 4-element array from buildUserCommands, or
      //                 (b) a flat byte array (legacy — just the profile cmd).
      let initCmds;
      if (userCmd) {
        if (Array.isArray(userCmd[0])) {
          initCmds = userCmd;
        } else {
          const a = userCmd[2] || 0x19;
          const deviceChk    = (0x20 + 0x08 + a + 0xF2 + 0x68 + 0xB4 + 0x31) & 0xFF;
          const sessionChk   = (0x22 + 0x04 + a) & 0xFF;
          const heartbeatChk = (0x1F + 0x05 + a + 0x10) & 0xFF;
          initCmds = [
            userCmd,
            [0x20, 0x08, a, 0xF2, 0x68, 0xB4, 0x31, deviceChk],
            [0x22, 0x04, a, sessionChk],
            [0x1F, 0x05, a, 0x10, heartbeatChk],
          ];
        }
      } else {
        initCmds = [CMD_PROFILE_DEFAULT, CMD_DEVICE, CMD_SESSION_DEFAULT, CMD_HEARTBEAT_DEFAULT];
      }

      // heartbeatCmdVar is mutable because phase2 may rebuild it with the stored age
      let heartbeatCmdVar = initCmds[3] || CMD_HEARTBEAT_DEFAULT;
      let inLiveMode      = false;

      // ── Two-phase challenge-response init ─────────────────────────────────────
      //
      // The scale uses a challenge-response handshake:
      //   PHASE 1:  Send CMD_DEVICE (0x20) → FFE4.
      //   CHALLENGE: Scale replies with 0x21 on FFE2 containing its stored profile
      //              age at byte[2].
      //   PHASE 2:  Echo the stored age back in CMD_PROFILE (0x13) and
      //             CMD_SESSION (0x22).  Sending a different age causes the scale
      //             to disconnect immediately after the 0x14 ACK.
      //
      // If no 0x21 arrives within 2 s we fall back to the age in our own profile
      // command (handles fresh scales with no stored profile).

      let phase2Done  = false;
      let phase2Timer = null;

      function doPhase2(storedAge) {
        if (phase2Done || cancelled) return;
        phase2Done = true;
        if (phase2Timer) { clearTimeout(phase2Timer); phase2Timer = null; }

        const a = storedAge & 0xFF;
        // Keep our height/gender from the original profile command; use stored age.
        const origProfile = initCmds[0]; // [0x13, unit, age, gender, 0x10, height, age, 0x00, chk]
        const h = origProfile[5] || 0xAA; // height_cm
        const g = origProfile[3] || 0x01; // gender

        const profileChk = (0x13 + UNIT_KG + a + g + 0x10 + h + a + 0x00) & 0xFF;
        const profileCmd = [0x13, UNIT_KG, a, g, 0x10, h, a, 0x00, profileChk];
        const sessionChk = (0x22 + 0x04 + a) & 0xFF;
        const sessionCmd = [0x22, 0x04, a, sessionChk];
        const hbChk      = (0x1F + 0x05 + a + 0x10) & 0xFF;
        heartbeatCmdVar  = [0x1F, 0x05, a, 0x10, hbChk]; // update for new age

        console.log(`[Scale] phase2 age=0x${a.toString(16)}(${a}) ` +
          `profile=${profileCmd.map(b=>b.toString(16).padStart(2,"0")).join(" ")}`);
        writeTo(CHAR_CMD, profileCmd)
          .then(() => { if (!cancelled) return writeTo(CHAR_CMD2, sessionCmd); });
      }

      // ── Subscribe to FFE2 FIRST so we don't miss the 0x21 challenge ──────────
      console.log("[Scale] subscribing FFE2 + FFE1");
      try {
        subInd = connected.monitorCharacteristicForService(svcUUID, CHAR_IND, (err, char) => {
          if (err) { console.log("[Scale] FFE2 ind error:", err?.reason || err?.message); return; }
          if (!char?.value) return;
          const bytes = base64ToBytes(char.value);
          const b0 = bytes[0] & 0xff;
          console.log("[Scale] FFE2 ind:", Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join(" "));
          // 0x21 = CMD_DEVICE ACK — byte[2] is the scale's stored profile age (challenge)
          if (b0 === 0x21 && bytes.length >= 3) {
            const storedAge = bytes[2] & 0xff;
            console.log(`[Scale] 0x21 challenge received: stored age=0x${storedAge.toString(16)} (${storedAge})`);
            doPhase2(storedAge);
          }
        });
        console.log("[Scale] FFE2 subscribed");
      } catch (e) {
        console.log("[Scale] FFE2 subscribe failed (non-fatal):", e?.message);
      }

      // ── Subscribe to FFE1 (measurement + profile-ACK notifications) ──────────
      // Packet types on FFE1:
      //   0x12 = replay/idle (scale broadcasting cached weight, no app session)
      //   0x14 = CMD_PROFILE ACK — scale accepted profile+session, ready for measurement
      //   0x10 = live measurement (smart scale, connected session); stable flag at byte[5]
      //   0x1C = live measurement unstable  (alternate firmware)
      //   0x1D = live measurement stable    (alternate firmware)
      const stab = makeStabilityTracker();
      sub = connected.monitorCharacteristicForService(svcUUID, notifyUUID, (err, char) => {
        if (err) {
          console.log("[Scale] FFE1 error:", err?.reason || err?.message);
          // (no retry timer to clear — phase2 is one-shot)
          onError(err.reason || err.message || "Read error");
          return;
        }
        if (!char?.value) return;

        const bytes = base64ToBytes(char.value);
        const b0 = bytes.length ? (bytes[0] & 0xff) : 0;
        console.log("[Scale] FFE1 raw:", Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join(" "));

        // 0x14 = CMD_PROFILE accepted + session started.
        // Scale is now waiting for the user to step on it.
        if (b0 === 0x14) {
          console.log("[Scale] ✓ 0x14 session ACK — scale ready, starting heartbeat");
          if (!heartbeatTimer) heartbeatTimer = scheduleHeartbeat(heartbeatCmdVar);
          return;
        }

        const parsed = parsePacket(char.value);
        if (!parsed) return;

        const wasLive = inLiveMode;
        // 0x10 = smart scale live measurement; 0x1C/0x1D = alternate firmware live measurement
        inLiveMode = (parsed.packetType === 0x10 ||
                      parsed.packetType === 0x1C ||
                      parsed.packetType === 0x1D);
        if (inLiveMode && !wasLive) {
          console.log("[Scale] ✓ live mode — starting heartbeat");
          if (!heartbeatTimer) heartbeatTimer = scheduleHeartbeat(heartbeatCmdVar);
        }

        // For 0x10 packets the scale sets a hardware stable flag at byte[5] —
        // trust it directly. Only fall back to the software window tracker for
        // packet types that don't carry a reliable hardware flag.
        const isStable = (parsed.packetType === 0x10)
          ? parsed.hardwareStable
          : (parsed.hardwareStable || stab(parsed.weight));

        console.log(`[Scale] w=${parsed.weight} stable=${isStable} hw=${parsed.hardwareStable} type=0x${parsed.packetType.toString(16)} live=${inLiveMode}`);
        onMeasurement({
          weight:     parsed.weight,
          isStable,
          impedance:  parsed.impedance,
          packetType: parsed.packetType,
          isLiveMode: inLiveMode,
        });
      });

      // ── PHASE 1: Send CMD_DEVICE, then await the 0x21 challenge ─────────────
      console.log("[Scale] phase1: sending CMD_DEVICE");
      await writeTo(CHAR_CMD2, initCmds[1]); // CMD_DEVICE → FFE4

      // Fallback: if no 0x21 challenge within 2 s, proceed with our own age
      phase2Timer = setTimeout(() => {
        console.log("[Scale] no 0x21 challenge in 2 s — using app profile age");
        doPhase2(initCmds[0][2] || 0x19); // age from original profile cmd
      }, 2000);

      onWriteReady?.(writeCmd);

      if (!cancelled) {
        onConnected?.();
      }

    } catch (e) {
      if (!cancelled) {
        console.log("[Scale] run() error:", e?.message || e);
        onError(e?.reason || e?.message || "Could not connect to scale.");
      }
    }
  }

  run();

  return () => {
    console.log("[Scale] cleanup called");
    cancelled = true;
    if (retryDelay)     { clearTimeout(retryDelay);     retryDelay     = null; }
    if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
    try { sub?.remove();    } catch {}
    try { subInd?.remove(); } catch {}
    try { connected?.cancelConnection(); } catch {}
    if (deviceId) try { m.cancelDeviceConnection(deviceId); } catch {}
  };
}

// ── Body composition ──────────────────────────────────────────────────────────
//
// When the scale sends a valid impedance (Ω) with the stable reading, we use a
// BIA (bio-electrical impedance analysis) formula — the same technique used by
// FeelFit and other smart-scale apps.  This is significantly more accurate than
// the BMI-only fallback because it actually measures how current flows through
// fat vs. lean tissue.
//
// Formula: Segal (1988) / Lukaski (1985) lean-body-mass from impedance index.
//   LBM(women) = 0.469 × BII + 0.292 × W + 0.148 × H − 7.015
//   LBM(men)   = 0.734 × BII + 0.116 × W + 0.096 × H − 4.030
// where BII = H² / R  (H in cm, R = impedance in Ω, W = weight in kg)
//
// Muscle mass uses a 0.88 multiplier (total muscle including smooth / cardiac),
// matching the reporting convention of major consumer scales (Tanita / QN family).

export function calculateBodyComposition(weight, heightCm, age, gender, impedance = null) {
  if (!weight || !heightCm || !age) return {};
  const h   = heightCm / 100;
  const bmi = Math.round((weight / (h * h)) * 10) / 10;
  const male = (gender || "").toLowerCase().startsWith("m");

  let lbm;

  if (impedance && impedance > 50 && impedance < 5000) {
    // ── BIA path (more accurate) ─────────────────────────────────────────────
    const bii    = (heightCm * heightCm) / impedance; // bio-impedance index
    const rawLbm = male
      ? 0.734 * bii + 0.116 * weight + 0.096 * heightCm - 4.030  // Lukaski men
      : 0.469 * bii + 0.292 * weight + 0.148 * heightCm - 7.015; // Segal lean women
    // Clamp to physiologically plausible range (30 %–98 % of body weight)
    lbm = Math.max(weight * 0.30, Math.min(weight * 0.98, rawLbm));
  } else {
    // ── BMI fallback (no impedance available) ───────────────────────────────
    const rawFat = male
      ? 1.2 * bmi + 0.23 * age - 16.2
      : 1.2 * bmi + 0.23 * age - 5.4;
    const bodyFat = Math.max(3, Math.min(55, rawFat));
    lbm = weight * (1 - bodyFat / 100);
  }

  const bodyFatPercent   = Math.round(Math.max(3, Math.min(60, (weight - lbm) / weight * 100)) * 10) / 10;
  const muscleMassKg     = Math.round(lbm * 0.88 * 10) / 10;
  const boneMassKg       = Math.round(weight * (male ? 0.032 : 0.028) * 100) / 100;
  const waterPercent     = Math.round(Math.max(35, 73.2 - bodyFatPercent * 0.55) * 10) / 10;
  const visceralFatLevel = Math.round(Math.max(1, Math.min(30, bodyFatPercent * 0.4 - 4)) * 10) / 10;
  const bmr = Math.round(male
    ? 10 * weight + 6.25 * heightCm - 5 * age + 5
    : 10 * weight + 6.25 * heightCm - 5 * age - 161);
  // Protein % ≈ lean-mass fraction × 20 (protein is ~20 % of lean tissue by wet weight).
  // For 10 % body fat → 0.90 × 20 = 18 %, matching typical consumer-scale output.
  const proteinPercent = Math.round(Math.max(5, Math.min(30, (1 - bodyFatPercent / 100) * 20)) * 10) / 10;
  return { bmi, bodyFatPercent, muscleMassKg, boneMassKg, waterPercent, visceralFatLevel, bmr, proteinPercent };
}

export function destroyBleManager() {
  if (_manager) { try { _manager.destroy(); } catch {} _manager = null; }
}
