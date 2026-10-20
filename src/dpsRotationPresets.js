const ROTATION_PRESETS_STORAGE_KEY = "teyvat-nexus.dps-rotation-presets.v1";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRotationPreset(value) {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.teamPresetId === "string" &&
    Array.isArray(value.actions) &&
    value.actions.every((action) =>
      isRecord(action) &&
      Number.isInteger(action.memberIndex) &&
      typeof action.talentKey === "string");
}

export function readRotationPresets() {
  try {
    const saved = window.localStorage.getItem(ROTATION_PRESETS_STORAGE_KEY);
    if (!saved) return { presets: [], error: "" };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some((preset) => !isRotationPreset(preset))) {
      throw new Error("Saved rotation presets have an unsupported format.");
    }
    return { presets: parsed, error: "" };
  } catch (error) {
    return {
      presets: [],
      error: `Could not read saved rotation presets: ${
        error instanceof Error ? error.message : "browser storage is unavailable."
      }`,
    };
  }
}

export function saveRotationPresets(presets) {
  window.localStorage.setItem(ROTATION_PRESETS_STORAGE_KEY, JSON.stringify(presets));
}
