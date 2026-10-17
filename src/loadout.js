const LOADOUT_STORAGE_KEY = "teyvat-nexus.loadout.v1";

const ARTIFACT_SLOTS = new Set(["flower", "plume", "sands", "goblet", "circlet"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteInteger(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function hasGoodKey(value) {
  return (typeof value === "string" && value.length > 0) ||
    (typeof value === "number" && Number.isFinite(value));
}

function isStoredEntry(entry, kind) {
  if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id) return false;
  if (entry.source === "GOOD") {
    if (!isRecord(entry.good)) return false;
    if (kind === "weapons") {
      return hasGoodKey(entry.good.key) &&
        isFiniteInteger(entry.good.level, 1, 90) &&
        isFiniteInteger(entry.good.ascension, 0, 6) &&
        isFiniteInteger(entry.good.refinement, 1, 5);
    }
    return hasGoodKey(entry.good.setKey) &&
      ARTIFACT_SLOTS.has(entry.good.slotKey) &&
      isFiniteInteger(entry.good.level, 0, 20) &&
      isFiniteInteger(entry.good.rarity, 1, 5) &&
      typeof entry.good.mainStatKey === "string";
  }
  if (entry.source !== "manual") return false;
  return kind === "weapons"
    ? (typeof entry.catalogId === "string" ||
        (typeof entry.name === "string" && typeof entry.weaponType === "string")) &&
        Number.isInteger(entry.rarity) &&
        Number.isInteger(entry.level) &&
        entry.level >= 1 &&
        entry.level <= 90 &&
        Number.isInteger(entry.ascension) &&
        entry.ascension >= 0 &&
        entry.ascension <= 6 &&
        Number.isInteger(entry.refinement) &&
        entry.refinement >= 1 &&
        entry.refinement <= 5
    : (typeof entry.catalogId === "string" || typeof entry.setName === "string") &&
        ARTIFACT_SLOTS.has(entry.slot) &&
        isFiniteInteger(entry.level, 0, 20) &&
        isFiniteInteger(entry.rarity, 1, 5) &&
        typeof entry.mainStat === "string" &&
        Array.isArray(entry.substats);
}

function validateGoodWeapon(weapon, index) {
  if (
    !isRecord(weapon) ||
    !hasGoodKey(weapon.key) ||
    !isFiniteInteger(weapon.level, 1, 90) ||
    !isFiniteInteger(weapon.ascension, 0, 6) ||
    !isFiniteInteger(weapon.refinement, 1, 5) ||
    typeof weapon.location !== "string" ||
    typeof weapon.lock !== "boolean"
  ) {
    throw new Error(`Weapon ${index + 1} is missing valid GOOD weapon fields.`);
  }
  return weapon;
}

function validateGoodArtifact(artifact, index) {
  if (
    !isRecord(artifact) ||
    !hasGoodKey(artifact.setKey) ||
    typeof artifact.slotKey !== "string" ||
    !ARTIFACT_SLOTS.has(artifact.slotKey) ||
    !isFiniteInteger(artifact.level, 0, 20) ||
    !isFiniteInteger(artifact.rarity, 1, 5) ||
    typeof artifact.mainStatKey !== "string" ||
    typeof artifact.location !== "string" ||
    typeof artifact.lock !== "boolean" ||
    !Array.isArray(artifact.substats) ||
    artifact.substats.some(
      (stat) =>
        !isRecord(stat) ||
        typeof stat.key !== "string" ||
        typeof stat.value !== "number" ||
        !Number.isFinite(stat.value),
    )
  ) {
    throw new Error(`Artifact ${index + 1} is missing valid GOOD artifact fields.`);
  }
  return artifact;
}

export function parseGoodFile(contents) {
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`The selected file is not valid JSON: ${error.message}`);
  }

  if (
    !isRecord(parsed) ||
    parsed.format !== "GOOD" ||
    !Array.isArray(parsed.weapons) ||
    !Array.isArray(parsed.artifacts)
  ) {
    throw new Error("This file is not a supported GOOD export with weapons and artifacts arrays.");
  }

  return {
    weapons: parsed.weapons.map(validateGoodWeapon),
    artifacts: parsed.artifacts.map(validateGoodArtifact),
  };
}

export function readSavedLoadout() {
  try {
    const saved = window.localStorage.getItem(LOADOUT_STORAGE_KEY);
    if (!saved) return { data: { weapons: [], artifacts: [] }, error: "" };
    const parsed = JSON.parse(saved);
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.weapons) ||
      !Array.isArray(parsed.artifacts) ||
      !parsed.weapons.every((entry) => isStoredEntry(entry, "weapons")) ||
      !parsed.artifacts.every((entry) => isStoredEntry(entry, "artifacts"))
    ) {
      throw new Error("Saved loadout data has an unsupported format.");
    }
    return { data: { weapons: parsed.weapons, artifacts: parsed.artifacts }, error: "" };
  } catch (error) {
    return {
      data: { weapons: [], artifacts: [] },
      error: `Could not read the saved loadout: ${error.message}`,
    };
  }
}

export function saveLoadout(data) {
  window.localStorage.setItem(
    LOADOUT_STORAGE_KEY,
    JSON.stringify({ version: 1, weapons: data.weapons, artifacts: data.artifacts }),
  );
}

export function normalizeSavedLoadout(data, catalogs) {
  let removedWeapons = 0;
  let removedArtifacts = 0;
  const weapons = data.weapons.flatMap((entry) => {
    const catalogWeapon = entry.source === "GOOD"
      ? resolveGoodWeapon(entry.good.key, catalogs.weapons)
      : catalogs.weapons.find(
        (weapon) =>
          String(weapon.id) === String(entry.catalogId) ||
          weapon.name.toLowerCase() === String(entry.name || "").toLowerCase(),
      );
    if (!catalogWeapon) {
      removedWeapons += 1;
      return [];
    }
    if (entry.source === "GOOD") {
      return [{ ...entry, catalogId: String(catalogWeapon.id) }];
    }
    return [{
      ...entry,
      catalogId: String(catalogWeapon.id),
      name: catalogWeapon.name,
      weaponType: catalogWeapon.weaponType,
      rarity: catalogWeapon.rarity,
    }];
  });
  const artifacts = data.artifacts.flatMap((entry) => {
    const catalogArtifact = entry.source === "GOOD"
      ? resolveGoodArtifact(entry.good.setKey, catalogs.artifacts)
      : catalogs.artifacts.find(
        (artifact) =>
          String(artifact.id) === String(entry.catalogId) ||
          artifact.name.toLowerCase() === String(entry.setName || "").toLowerCase(),
      );
    const rarity = entry.source === "GOOD" ? entry.good.rarity : entry.rarity;
    const slot = entry.source === "GOOD" ? entry.good.slotKey : entry.slot;
    if (
      !catalogArtifact ||
      !ARTIFACT_SLOTS.has(slot) ||
      !(catalogArtifact.rarityList || []).includes(rarity)
    ) {
      removedArtifacts += 1;
      return [];
    }
    if (entry.source === "GOOD") {
      return [{ ...entry, catalogId: String(catalogArtifact.id) }];
    }
    return [{
      ...entry,
      catalogId: String(catalogArtifact.id),
      setName: catalogArtifact.name,
    }];
  });

  return {
    data: { weapons, artifacts },
    removedWeapons,
    removedArtifacts,
  };
}

export function makeLoadoutId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = stableValue(value[key]);
      return sorted;
    }, {});
}

function recordFingerprint(record) {
  return JSON.stringify(stableValue(record));
}

function normalizeSetKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveGoodWeapon(key, weapons) {
  const rawKey = String(key);
  const direct = weapons.find((weapon) => String(weapon.id) === rawKey);
  if (direct && /^\d+$/.test(rawKey)) return direct;
  const match = rawKey.match(/^(?:(?:weapon)_)?(sword|claymore|polearm|bow|catalyst)_(\d+)$/i);
  if (!match) return undefined;
  const [, type, id] = match;
  return weapons.find(
    (weapon) =>
      String(weapon.id) === id &&
      String(weapon.weaponType || "").toLowerCase() === type.toLowerCase(),
  );
}

function resolveGoodArtifact(setKey, artifacts) {
  const rawKey = String(setKey);
  return artifacts.find((artifact) => String(artifact.id) === rawKey) ||
    artifacts.find((artifact) => normalizeSetKey(artifact.name) === normalizeSetKey(rawKey));
}

export function mergeGoodInventory(current, imported, catalogs) {
  const weapons = [...current.weapons];
  const artifacts = [...current.artifacts];
  const weaponFingerprints = new Set(
    weapons.filter((entry) => entry.source === "GOOD").map((entry) => recordFingerprint(entry.good)),
  );
  const artifactFingerprints = new Set(
    artifacts.filter((entry) => entry.source === "GOOD").map((entry) => recordFingerprint(entry.good)),
  );
  let addedWeapons = 0;
  let addedArtifacts = 0;
  let unrecognizedWeapons = 0;
  let unrecognizedArtifacts = 0;

  imported.weapons.forEach((good) => {
    const catalogWeapon = resolveGoodWeapon(good.key, catalogs.weapons);
    if (!catalogWeapon) {
      unrecognizedWeapons += 1;
      return;
    }
    const fingerprint = recordFingerprint(good);
    if (weaponFingerprints.has(fingerprint)) return;
    weaponFingerprints.add(fingerprint);
    weapons.push({
      id: makeLoadoutId(),
      source: "GOOD",
      catalogId: String(catalogWeapon.id),
      good,
    });
    addedWeapons += 1;
  });
  imported.artifacts.forEach((good) => {
    const catalogArtifact = resolveGoodArtifact(good.setKey, catalogs.artifacts);
    if (!catalogArtifact) {
      unrecognizedArtifacts += 1;
      return;
    }
    const fingerprint = recordFingerprint(good);
    if (artifactFingerprints.has(fingerprint)) return;
    artifactFingerprints.add(fingerprint);
    artifacts.push({
      id: makeLoadoutId(),
      source: "GOOD",
      catalogId: String(catalogArtifact.id),
      good,
    });
    addedArtifacts += 1;
  });

  return {
    data: { weapons, artifacts },
    addedWeapons,
    addedArtifacts,
    unrecognizedWeapons,
    unrecognizedArtifacts,
  };
}
