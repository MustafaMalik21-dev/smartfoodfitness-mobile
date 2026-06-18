/**
 * Custom Expo config plugin to write kotlinVersion and kspVersion directly to
 * android/gradle.properties so they are available during Gradle buildscript
 * evaluation (before ext properties are set by ExpoRootProjectPlugin).
 *
 * - expo-updates reads rootProject.hasProperty("kspVersion") in its buildscript
 *   to determine the KSP version. Gradle project properties from gradle.properties
 *   ARE available at buildscript evaluation time.
 * - react-native-health-connect reads rootProject.ext.has("kotlinVersion") in its
 *   buildscript. This plugin also writes kotlinVersion so it flows through.
 *
 * React Native 0.81 uses Kotlin 2.1.20 (from libs.versions.toml).
 * Matching KSP version: 2.1.20-2.0.1 (from expo-modules-autolinking KSPLookup.kt).
 */

const { withGradleProperties } = require("@expo/config-plugins");

const KOTLIN_VERSION = "2.1.20";
const KSP_VERSION = "2.1.20-2.0.1";

module.exports = function withKotlinGradleProps(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    const addOrUpdate = (key, value) => {
      const idx = props.findIndex(
        (p) => p.type === "property" && p.key === key
      );
      const entry = { type: "property", key, value };
      if (idx >= 0) {
        props[idx] = entry;
      } else {
        props.push(entry);
      }
    };

    // Set kotlinVersion without the "android." prefix so that:
    //   rootProject["kotlinVersion"] in expo-updates buildscript finds it
    //   rootProject.ext.has("kotlinVersion") in health-connect will not find it
    //   (ext vs project property), but ExpoRootProjectPlugin will use setIfNotExist
    //   which won't override since it checks ext — so the version catalog value (2.1.20)
    //   from RN 0.81 will be used by ExpoRootProjectPlugin anyway.
    addOrUpdate("kotlinVersion", KOTLIN_VERSION);

    // kspVersion is checked FIRST by expo-updates before the kotlinVersion lookup.
    // This is the most direct fix for the NoSuchMethodError in kspReleaseKotlin.
    addOrUpdate("kspVersion", KSP_VERSION);

    return config;
  });
};
