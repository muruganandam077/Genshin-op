const PRESETS_STORAGE_KEY = "teyvat-nexus.team-presets.v1";
const SLOTS = ["flower", "plume", "sands", "goblet", "circlet"];
const MAIN_STAT_VALUES = {
  hp: 4780,
  hp_: 46.6,
  atk: 311,
  atk_: 46.6,
  def: 58.3,
  def_: 58.3,
  eleMas: 187,
  enerRech_: 51.8,
  critRate_: 31.1,
  critDMG_: 62.2,
  physical_dmg_: 58.3,
  anemo_dmg_: 46.6,
  cryo_dmg_: 46.6,
  dendro_dmg_: 46.6,
  electro_dmg_: 46.6,
  geo_dmg_: 46.6,
  hydro_dmg_: 46.6,
  pyro_dmg_: 46.6,
};
const STAT_ALIASES = [
  ["critDMG_", /crit(?:ical)?\s*(?:dmg|damage)|critDMG_/i],
  ["critRate_", /crit(?:ical)?\s*rate|critRate_/i],
  ["enerRech_", /energy\s*recharge|enerRech_/i],
  ["eleMas", /elemental\s*mastery|eleMas|\bEM\b/i],
  ["physical_dmg_", /physical(?:\s*dmg|\s*damage)?\s*bonus|physical_dmg_/i],
  ["anemo_dmg_", /anemo(?:\s*dmg|\s*damage)?(?:\s*bonus)?|anemo_dmg_/i],
  ["cryo_dmg_", /cryo(?:\s*dmg|\s*damage)?(?:\s*bonus)?|cryo_dmg_/i],
  ["dendro_dmg_", /dendro(?:\s*dmg|\s*damage)?(?:\s*bonus)?|dendro_dmg_/i],
  ["electro_dmg_", /electro(?:\s*dmg|\s*damage)?(?:\s*bonus)?|electro_dmg_/i],
  ["geo_dmg_", /geo(?:\s*dmg|\s*damage)?(?:\s*bonus)?|geo_dmg_/i],
  ["hydro_dmg_", /hydro(?:\s*dmg|\s*damage)?(?:\s*bonus)?|hydro_dmg_/i],
  ["pyro_dmg_", /pyro(?:\s*dmg|\s*damage)?(?:\s*bonus)?|pyro_dmg_/i],
  ["hp_", /max(?:imum)?\s*hp\s*%|hp\s*%|hp_/i],
  ["atk_", /attack\s*%|atk\s*%|atk_/i],
  ["def_", /defense\s*%|def\s*%|def_/i],
  ["atk", /\batk\b|attack/i],
  ["def", /\bdef\b|defense/i],
  ["hp", /\bhp\b|health/i],
];
const ROLE_WEIGHTS = {
  dps: { critRate_: 2, critDMG_: 1, atk_: 0.72, atk: 0.018, enerRech_: 0.34, eleMas: 0.12, hp_: 0.2, def_: 0.16, damage: 0.8 },
  offField: { critRate_: 1.55, critDMG_: 1, atk_: 0.62, atk: 0.016, enerRech_: 0.78, eleMas: 0.38, hp_: 0.22, def_: 0.16, damage: 0.75 },
  support: { critRate_: 0.48, critDMG_: 0.3, atk_: 0.62, atk: 0.016, enerRech_: 1.25, eleMas: 0.38, hp_: 0.72, hp: 0.0015, def_: 0.65, def: 0.012, damage: 0.28 },
  reaction: { critRate_: 0.88, critDMG_: 0.62, atk_: 0.42, atk: 0.012, enerRech_: 0.62, eleMas: 0.92, hp_: 0.18, def_: 0.16, damage: 0.56 },
};
const ROLE_PRIORITY = { dps: 0, offField: 1, reaction: 2, support: 3 };
const STELLAR_ATK_SCALERS = new Set(["Yae Miko", "Odette"]);
const STELLAR_CONDUCT_ENABLERS = new Set(["Sandrone", "Cryo Traveler", "Odette"]);

function hasCryoResonance(team) {
  return team.filter((member) => member.character.element === "Cryo").length >= 2;
}

function hasStellarConductEnabler(team) {
  return team.some((member) =>
    STELLAR_CONDUCT_ENABLERS.has(member.character.name));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeGoodStat(key) {
  const normalized = String(key || "").toLowerCase();
  if (normalized === "enerrech_") return "enerRech_";
  if (normalized === "critdmg_") return "critDMG_";
  if (normalized === "critrate_") return "critRate_";
  if (normalized === "elemas") return "eleMas";
  return key;
}

function parseManualStat(value) {
  const text = String(value || "");
  const match = STAT_ALIASES.find(([, expression]) => expression.test(text));
  const amount = text.match(/(\d+(?:\.\d+)?)/);
  if (!match || !amount) return null;
  return { key: match[0], value: Number(amount[1]) };
}

function getArtifactStats(entry) {
  if (entry.source === "GOOD") {
    const good = entry.good;
    const mainKey = normalizeGoodStat(good.mainStatKey);
    const stats = [{ key: mainKey, value: MAIN_STAT_VALUES[mainKey] || 0 }];
    good.substats.forEach((stat) => {
      stats.push({ key: normalizeGoodStat(stat.key), value: stat.value });
    });
    return stats;
  }
  return [
    parseManualStat(entry.mainStat),
    ...entry.substats.map(parseManualStat),
  ].filter(Boolean);
}

function getLevel90Stats(record) {
  const progression = record.ascensionStats || [];
  return progression
    .filter((entry) => entry.level === 90)
    .sort((a, b) => b.ascension - a.ascension)[0] ||
    [...progression].sort((a, b) => b.level - a.level || b.ascension - a.ascension)[0] ||
    null;
}

function statKeyFromLabel(label, percentForBaseStat = false) {
  const stat = String(label || "").toLowerCase();
  if (/crit(?:ical)?\s*dmg|critDMG_/.test(stat)) return "critDMG_";
  if (/crit(?:ical)?\s*rate|critRate_/.test(stat)) return "critRate_";
  if (/energy\s*recharge|enerRech_/.test(stat)) return "enerRech_";
  if (/elemental\s*mastery|eleMas|\bem\b/.test(stat)) return "eleMas";
  if (/physical/.test(stat)) return "physical_dmg_";
  if (/anemo/.test(stat)) return "anemo_dmg_";
  if (/cryo/.test(stat)) return "cryo_dmg_";
  if (/dendro/.test(stat)) return "dendro_dmg_";
  if (/electro/.test(stat)) return "electro_dmg_";
  if (/geo/.test(stat)) return "geo_dmg_";
  if (/hydro/.test(stat)) return "hydro_dmg_";
  if (/pyro/.test(stat)) return "pyro_dmg_";
  if (/def/.test(stat)) return /%/.test(stat) || percentForBaseStat ? "def_" : "def";
  if (/hp/.test(stat)) return /%/.test(stat) || percentForBaseStat ? "hp_" : "hp";
  if (/atk|attack/.test(stat)) return /%/.test(stat) || percentForBaseStat ? "atk_" : "atk";
  return null;
}

function specializedStatValue(record, key) {
  const value = getLevel90Stats(record)?.specialized || 0;
  return key?.endsWith("_") ? value * 100 : value;
}

function characterAscensionStatValue(character, key) {
  if (statKeyFromLabel(character.substat, true) !== key) return 0;
  const value = specializedStatValue(character, key);
  const embeddedBaseValue = key === "critRate_" ? 5 : key === "critDMG_" ? 50 : 0;
  return Math.max(0, Number((value - embeddedBaseValue).toFixed(1)));
}

function addStat(stats, key, value) {
  if (key && Number.isFinite(value)) stats[key] = (stats[key] || 0) + value;
}

function addStatSource(stats, sources, key, value, label) {
  addStat(stats, key, value);
  if (!key || !Number.isFinite(value)) return;
  const source = sources[key] || (sources[key] = []);
  const existing = source.find((entry) => entry.label === label);
  if (existing) existing.value += value;
  else source.push({ label, value });
}

function addSetStatBonuses(stats, sources, setGroups, artifacts) {
  setGroups.forEach((group) => {
    const set = artifacts.find((entry) => String(entry.id) === group.setId);
    if (!set) return;
    const effects = [];
    if (group.count >= 2) effects.push({ text: set.effect2Pc || "", label: `2-piece ${set.name}` });
    if (group.count >= 4) effects.push({ text: set.effect4Pc || "", label: `4-piece ${set.name}` });
    effects.forEach(({ text: effect, label }) => {
      const patterns = [
        ["atk_", /(?:ATK|Attack)\s*(?:is\s*)?(?:increased|increases)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?(?:ATK|Attack)\s+by\s+(\d+(?:\.\d+)?)\s*%|(?:ATK|Attack)\s*\+\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:ATK|Attack)\b/i],
        ["hp_", /(?:Max\s*)?HP\s*(?:is\s*)?(?:increased|increases)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?(?:Max\s*)?HP\s+by\s+(\d+(?:\.\d+)?)\s*%|(?:Max\s*)?HP\s*\+\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:Max\s*)?HP\b/i],
        ["def_", /(?:DEF|Defense)\s*(?:is\s*)?(?:increased|increases)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?(?:DEF|Defense)\s+by\s+(\d+(?:\.\d+)?)\s*%|(?:DEF|Defense)\s*\+\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:DEF|Defense)\b/i],
        ["critRate_", /CRIT(?:ical)?\s*Rate\s*(?:is\s*)?(?:increased|increases)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?CRIT(?:ical)?\s*Rate\s+by\s+(\d+(?:\.\d+)?)\s*%|CRIT(?:ical)?\s*Rate\s*\+\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*CRIT(?:ical)?\s*Rate\b/i],
        ["critDMG_", /CRIT(?:ical)?\s*(?:DMG|Damage)\s*(?:is\s*)?(?:increased|increases)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?CRIT(?:ical)?\s*(?:DMG|Damage)\s+by\s+(\d+(?:\.\d+)?)\s*%|CRIT(?:ical)?\s*(?:DMG|Damage)\s*\+\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*CRIT(?:ical)?\s*(?:DMG|Damage)\b/i],
        ["enerRech_", /Energy\s*Recharge\s*(?:is\s*)?(?:increased|increases)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Energy\s*Recharge\s+by\s+(\d+(?:\.\d+)?)\s*%|Energy\s*Recharge\s*\+\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*Energy\s*Recharge\b/i],
        ["physical_dmg_", /(\d+(?:\.\d+)?)\s*%\s*Physical\s*DMG\s*Bonus|Physical\s*DMG\s*Bonus\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Physical\s*DMG\s*Bonus\s+by\s+(\d+(?:\.\d+)?)\s*%/i],
        ["anemo_dmg_", /(\d+(?:\.\d+)?)\s*%\s*Anemo\s*DMG\s*Bonus|Anemo\s*DMG\s*Bonus\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Anemo\s*DMG\s*Bonus\s+by\s+(\d+(?:\.\d+)?)\s*%/i],
        ["cryo_dmg_", /(\d+(?:\.\d+)?)\s*%\s*Cryo\s*DMG\s*Bonus|Cryo\s*DMG\s*Bonus\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Cryo\s*DMG\s*Bonus\s+by\s+(\d+(?:\.\d+)?)\s*%/i],
        ["dendro_dmg_", /(\d+(?:\.\d+)?)\s*%\s*Dendro\s*DMG\s*Bonus|Dendro\s*DMG\s*Bonus\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Dendro\s*DMG\s*Bonus\s+by\s+(\d+(?:\.\d+)?)\s*%/i],
        ["electro_dmg_", /(\d+(?:\.\d+)?)\s*%\s*Electro\s*DMG\s*Bonus|Electro\s*DMG\s*Bonus\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Electro\s*DMG\s*Bonus\s+by\s+(\d+(?:\.\d+)?)\s*%/i],
        ["geo_dmg_", /(\d+(?:\.\d+)?)\s*%\s*Geo\s*DMG\s*Bonus|Geo\s*DMG\s*Bonus\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Geo\s*DMG\s*Bonus\s+by\s+(\d+(?:\.\d+)?)\s*%/i],
        ["hydro_dmg_", /(\d+(?:\.\d+)?)\s*%\s*Hydro\s*DMG\s*Bonus|Hydro\s*DMG\s*Bonus\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Hydro\s*DMG\s*Bonus\s+by\s+(\d+(?:\.\d+)?)\s*%/i],
        ["pyro_dmg_", /(\d+(?:\.\d+)?)\s*%\s*Pyro\s*DMG\s*Bonus|Pyro\s*DMG\s*Bonus\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\s*%|(?:increases?|increased)\s+(?:the\s+)?Pyro\s*DMG\s*Bonus\s+by\s+(\d+(?:\.\d+)?)\s*%/i],
      ];
      patterns.forEach(([key, expression]) => {
        const match = expression.exec(effect);
        const amount = match?.slice(1).find(Boolean);
        if (amount) addStatSource(stats, sources, key, Number(amount), label);
      });
      const mastery = /Elemental\s*Mastery\s*(?:is\s*)?(?:increased\s*by\s*)?(\d+(?:\.\d+)?)\b|(?:increases?|increased)\s+(?:the\s+)?Elemental\s*Mastery\s+by\s+(\d+(?:\.\d+)?)\b|(\d+(?:\.\d+)?)\s*(?:points?\s*of\s*)?Elemental\s*Mastery\b/i.exec(effect);
      const masteryAmount = mastery?.slice(1).find(Boolean);
      if (masteryAmount) addStatSource(stats, sources, "eleMas", Number(masteryAmount), label);
    });
  });
}

export function calculateBuildStats(build, weapon, artifacts, team = []) {
  const characterBase = getLevel90Stats(build.character);
  const weaponBase = weapon ? getLevel90Stats(weapon) : null;
  const artifactBonuses = {};
  const bonusSources = {};
  build.items.forEach((item) => {
    item.stats.forEach((stat, index) => addStatSource(
      artifactBonuses,
      bonusSources,
      stat.key,
      stat.value,
      `Artifact ${item.slot} ${index === 0 ? "main stat" : "substat"}`,
    ));
  });

  const characterBonusKey = statKeyFromLabel(build.character.substat, true);
  if (characterBase && characterBonusKey) {
    addStatSource(
      artifactBonuses,
      bonusSources,
      characterBonusKey,
      characterAscensionStatValue(build.character, characterBonusKey),
      "Character ascension",
    );
  }
  const weaponBonusKey = weapon ? statKeyFromLabel(`${weapon.mainStat || ""} ${weapon.baseStatText || ""}`) : null;
  if (weaponBase && weaponBonusKey) {
    addStatSource(
      artifactBonuses,
      bonusSources,
      weaponBonusKey,
      specializedStatValue(weapon, weaponBonusKey),
      "Weapon secondary stat",
    );
  }
  addSetStatBonuses(artifactBonuses, bonusSources, build.setGroups, artifacts);

  const baseAttack = (characterBase?.attack || 0) + (weaponBase?.attack || weapon?.baseAttack || 0);
  const attackMultiplier = 1 + (artifactBonuses.atk_ || 0) / 100;
  const attack = (baseAttack * attackMultiplier) +
    (artifactBonuses.atk || 0);
  const baseHp = characterBase?.hp || 0;
  const hpMultiplier = 1 + (artifactBonuses.hp_ || 0) / 100;
  const hp = baseHp * hpMultiplier +
    (artifactBonuses.hp || 0);
  const baseDefense = characterBase?.defense || 0;
  const defenseMultiplier = 1 + (artifactBonuses.def_ || 0) / 100;
  const defense = baseDefense * defenseMultiplier +
    (artifactBonuses.def || 0);
  const withBaseSources = (key, baseLabel, baseValue) => [
    ...(baseValue ? [{ label: baseLabel, value: baseValue }] : []),
    ...(bonusSources[key] || []),
  ];
  const statSources = {
    hp: [
      ...(baseHp ? [{ label: "Character base HP", value: baseHp }] : []),
      ...(bonusSources.hp_ || []).map((source) => ({
        label: `${source.label} (HP%)`,
        value: baseHp * source.value / 100,
      })),
      ...(bonusSources.hp || []),
    ],
    attack: [
      ...(characterBase?.attack ? [{
        label: "Character base ATK",
        value: characterBase.attack,
      }] : []),
      ...(weaponBase?.attack || weapon?.baseAttack ? [{
        label: "Weapon base ATK",
        value: weaponBase?.attack || weapon.baseAttack,
      }] : []),
      ...(bonusSources.atk_ || []).map((source) => ({
        label: `${source.label} (ATK%)`,
        value: baseAttack * source.value / 100,
      })),
      ...(bonusSources.atk || []),
    ],
    defense: [
      ...(baseDefense ? [{ label: "Character base DEF", value: baseDefense }] : []),
      ...(bonusSources.def_ || []).map((source) => ({
        label: `${source.label} (DEF%)`,
        value: baseDefense * source.value / 100,
      })),
      ...(bonusSources.def || []),
    ],
    elementalMastery: bonusSources.eleMas || [],
    critRate: [
      ...withBaseSources("critRate_", "Base CRIT Rate", 5),
      ...(hasCryoResonance(team)
        ? [{ label: "Cryo Resonance", value: 15 }]
        : []),
    ],
    critDamage: withBaseSources("critDMG_", "Base CRIT DMG", 50),
    energyRecharge: withBaseSources("enerRech_", "Base Energy Recharge", 100),
    elementalDamageBonus: bonusSources[`${String(build.character.element).toLowerCase()}_dmg_`] || [],
  };
  const statSourceUnits = {
    hp: "",
    attack: "",
    defense: "",
    elementalMastery: "",
    critRate: "%",
    critDamage: "%",
    energyRecharge: "%",
    elementalDamageBonus: "%",
  };

  return {
    hp,
    baseHp,
    attack,
    baseAttack,
    defense,
    elementalMastery: artifactBonuses.eleMas || 0,
    elementalDamageBonus: artifactBonuses[`${String(build.character.element).toLowerCase()}_dmg_`] || 0,
    physicalDamageBonus: artifactBonuses.physical_dmg_ || 0,
    critRate: Math.min(100, 5 + (artifactBonuses.critRate_ || 0) +
      (hasCryoResonance(team) ? 15 : 0)),
    critRateRaw: 5 + (artifactBonuses.critRate_ || 0) +
      (hasCryoResonance(team) ? 15 : 0),
    critDamage: 50 + (artifactBonuses.critDMG_ || 0),
    energyRecharge: 100 + (artifactBonuses.enerRech_ || 0),
    statSources,
    statSourceUnits,
    baseLevel: characterBase?.level || null,
    weaponLevel: weaponBase?.level || (weapon ? null : null),
    hasCharacterBase: Boolean(characterBase),
    hasWeaponBase: Boolean(weaponBase || weapon?.baseAttack),
  };
}

function hasDirectElementalMasteryDamageScaling(character) {
  return (character.passives || []).some((passive) => {
    const description = `${passive.description || ""} ${passive.descriptionRaw || ""}`;
    return /DMG values? (?:will be )?increased based on (?:his|her|their) Elemental Mastery/i.test(description) ||
      /(?:each|every) point of [\s\S]{0,100}Elemental Mastery[\s\S]{0,150}(?:(?:DMG|damage)[\s\S]{0,100}(?:increas|boost|scale)|(?:increas|boost|scale)[\s\S]{0,100}(?:DMG|damage))/i.test(description);
  });
}

function keyWeight(key, character, role, team = [], slot = "") {
  const weights = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.dps;
  if (STELLAR_ATK_SCALERS.has(character.name)) {
    if (key === "eleMas") return 0.08;
    if (key === "atk_" && slot === "sands") return 1.05;
  }
  if (character.name === "Yae Miko" &&
      hasStellarConductEnabler(team)) {
    if (key === "atk_" && slot === "goblet") return 0.9;
    if (key === "electro_dmg_") return 0.08;
  }
  if (key === "critRate_") return weights.critRate_;
  const hasMeltPartner = ["Pyro", "Cryo"].includes(character.element) &&
    team.some((member) =>
      member.id !== character.id &&
      member.character.element === (character.element === "Pyro" ? "Cryo" : "Pyro"));
  if (key === "eleMas" && role === "dps") {
    if (hasDirectElementalMasteryDamageScaling(character)) return 0.9;
    if (character.name === "Arlecchino" && slot === "sands" && !hasMeltPartner) return 0;
  }
  if (key === "eleMas" && slot === "goblet" && hasMeltPartner &&
      !hasDirectElementalMasteryDamageScaling(character)) {
    return 0.1;
  }
  if (key === "eleMas" && role === "dps") {
    if (slot === "sands" && hasMeltPartner) return 0.72;
  }
  if (key === "physical_dmg_") {
    return character.element === "None" ? 0.8 : 0.34;
  }
  if (key.endsWith("_dmg_")) {
    const statElement = key.split("_")[0];
    return statElement.toLowerCase() === String(character.element).toLowerCase()
      ? weights.damage
      : 0.08;
  }
  return weights[key] || 0;
}

function statScore(stats, character, role, team = [], slot = "") {
  return stats.reduce(
    (total, stat) => total + stat.value * keyWeight(stat.key, character, role, team, slot),
    0,
  );
}

function critRateScaleForBuild(character, weapon, setId, catalogs, team = []) {
  const set = catalogs.artifacts.find((artifact) => String(artifact.id) === String(setId));
  const setCritRate = readEffectStats(set?.effect4Pc || "")
    .filter((stat) => stat.key === "critRate_")
    .reduce((total, stat) => total + stat.value, 0);
  const characterCritRate = characterAscensionStatValue(character, "critRate_");
  const weaponKey = weapon
    ? statKeyFromLabel(`${weapon.mainStat || ""} ${weapon.baseStatText || ""}`)
    : null;
  const weaponCritRate = weaponKey === "critRate_"
    ? specializedStatValue(weapon, weaponKey)
    : 0;
  const resonanceCritRate = hasCryoResonance(team) ? 15 : 0;
  const remainingCritRate = Math.max(
    0,
    100 - 5 - characterCritRate - weaponCritRate - setCritRate - resonanceCritRate,
  );
  return Math.min(1, remainingCritRate / 100);
}

function readEffectStats(text) {
  const terms = {
    critDMG_: "CRIT DMG|CRIT DMG|critical damage",
    critRate_: "CRIT Rate|CRIT Rate|critical rate",
    enerRech_: "Energy Recharge|Energy Recharge|energy recharge",
    eleMas: "Elemental Mastery|Elemental Mastery|elemental mastery",
    physical_dmg_: "Physical DMG|Physical DMG|physical damage",
    anemo_dmg_: "Anemo DMG|Anemo DMG|Anemo damage",
    cryo_dmg_: "Cryo DMG|Cryo DMG|Cryo damage",
    dendro_dmg_: "Dendro DMG|Dendro DMG|Dendro damage",
    electro_dmg_: "Electro DMG|Electro DMG|Electro damage",
    geo_dmg_: "Geo DMG|Geo DMG|Geo damage",
    hydro_dmg_: "Hydro DMG|Hydro DMG|Hydro damage",
    pyro_dmg_: "Pyro DMG|Pyro DMG|Pyro damage",
    hp_: "Max HP|HP|HP",
    atk_: "ATK|Attack|ATK",
    def_: "DEF|Defense|DEF",
    atk: "ATK|Attack|ATK",
    def: "DEF|Defense|DEF",
    hp: "HP|Health|HP",
  };
  const result = [];
  for (const [key, term] of Object.entries(terms)) {
    const after = new RegExp(`(?:${term})[^.;\\n]{0,40}?(\\d+(?:\\.\\d+)?)\\s*(%)?`, "i").exec(text);
    const before = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(%)?[^.;\\n]{0,20}(?:${term})`, "i").exec(text);
    const match = after || before;
    if (match) {
      const percentStats = new Set(["atk_", "hp_", "def_", "critRate_", "critDMG_", "enerRech_"]);
      if (percentStats.has(key) && !match[2]) continue;
      if (!percentStats.has(key) && match[2]) continue;
      result.push({ key, value: Number(match[1]) });
    }
  }
  return result;
}

function setBonusScore(text, character, role, team) {
  if (!text) return 0;
  const stats = readEffectStats(text);
  let score = 0;
  if (stats.length) {
    const isTeamBuff = /party members|nearby party|all nearby|all party/i.test(text);
    if (isTeamBuff) {
      const allies = team.filter((member) => member.id !== character.id);
      score += Math.max(
        0,
        ...allies.map((ally) =>
          statScore(stats, ally.character, ally.role, team) * 0.42,
        ),
      );
    } else {
      score += statScore(stats, character, role, team) * 0.62;
    }
  }
  if (/\b(dmg|damage)\b/i.test(text) && !stats.some((stat) => stat.key.endsWith("_dmg_"))) {
    const amount = text.match(/(\d+(?:\.\d+)?)\s*%/);
    const isTeamBuff = /party members|nearby party|all nearby|all party/i.test(text);
    const fit = isTeamBuff
      ? Math.max(0, ...team.filter((member) => member.id !== character.id)
        .map((ally) => ally.role === "dps" || ally.role === "offField" ? 1 : 0.55))
      : role === "support" ? 0.55 : 1;
    score += Number(amount?.[1] || 10) * (ROLE_WEIGHTS[role]?.damage || 0.5) * 0.48 * fit;
  }
  if (/elemental mastery/i.test(text) && !stats.some((stat) => stat.key === "eleMas")) {
    score += 80 * (ROLE_WEIGHTS[role]?.eleMas || 0.4) * 0.62;
  }
  if (/energy recharge/i.test(text) && !stats.some((stat) => stat.key === "enerRech_")) {
    score += 20 * (ROLE_WEIGHTS[role]?.enerRech_ || 0.5) * 0.62;
  }
  return score;
}

function getEntrySetId(entry) {
  return String(entry.catalogId);
}

function getEntrySlot(entry) {
  return entry.source === "GOOD" ? entry.good.slotKey : entry.slot;
}

function scoreArtifact(entry, catalogs, character, role, team) {
  const slot = getEntrySlot(entry);
  const set = catalogs.artifacts.find((artifact) =>
    String(artifact.id) === getEntrySetId(entry));
  const stats = getArtifactStats(entry);
  const baseScore = statScore(stats, character, role, team, slot) +
    (entry.level || entry.good?.level || 0) * 0.18;
  return {
    entry,
    slot,
    setId: getEntrySetId(entry),
    setName: set?.name || entry.setName || "Unknown set",
    stats,
    baseScore,
    set2Score: set ? setBonusScore(set.effect2Pc, character, role, team) : 0,
    set4Score: set ? setBonusScore(set.effect4Pc, character, role, team) : 0,
  };
}

function artifactCritRateCorrection(items, character, role, critRateScale, weapon, team = []) {
  const artifactCritStats = items.reduce((totals, item) => {
    item.stats.forEach(({ key, value }) => {
      if (key === "critRate_") totals.rate += value;
      if (key === "critDMG_") totals.damage += value;
    });
    return totals;
  }, { rate: 0, damage: 0 });
  const baseCritRate = 100 - critRateScale * 100;
  const weaponCritKey = weapon
    ? statKeyFromLabel(`${weapon.mainStat || ""} ${weapon.baseStatText || ""}`)
    : null;
  const baseCritDamage = 50 +
    characterAscensionStatValue(character, "critDMG_") +
    (weaponCritKey === "critDMG_" ? specializedStatValue(weapon, weaponCritKey) : 0);
  const effectiveCritRate = Math.min(100, baseCritRate + artifactCritStats.rate);
  const expectedCritScore = effectiveCritRate *
    (baseCritDamage + artifactCritStats.damage) / 100;
  const critRateTargetScore = character.name === "Arlecchino"
    ? effectiveCritRate * 5
    : 0;
  const weights = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.dps;
  const previousCritScore = artifactCritStats.rate * weights.critRate_ +
    artifactCritStats.damage * weights.critDMG_;
  return expectedCritScore + critRateTargetScore - previousCritScore;
}

function buildForCharacter(character, role, preferredSetId, weapon, team, artifacts, catalogs, alreadyEquipped) {
  const critRateScale = critRateScaleForBuild(
    character,
    weapon,
    preferredSetId,
    catalogs,
    team,
  );
  const candidatesBySlot = Object.fromEntries(SLOTS.map((slot) => {
    const allCandidates = artifacts
      .filter((entry) => getEntrySlot(entry) === slot && !alreadyEquipped.has(entry.id))
      .map((entry) => scoreArtifact(entry, catalogs, character, role, team))
      .sort((a, b) =>
        (b.baseScore + Math.max(b.set2Score, b.set4Score * 0.6)) -
        (a.baseScore + Math.max(a.set2Score, a.set4Score * 0.6)));
    const selectedCandidates = allCandidates.slice(0, 70);
    allCandidates
      .filter((candidate) => candidate.setId === preferredSetId)
      .forEach((candidate) => {
        if (!selectedCandidates.some((selected) => selected.entry.id === candidate.entry.id)) {
          selectedCandidates.push(candidate);
        }
      });
    return [slot, selectedCandidates];
  }));
  if (SLOTS.some((slot) => !candidatesBySlot[slot].length)) return null;

  let best;
  if (preferredSetId) {
    const preferredBySlot = Object.fromEntries(SLOTS.map((slot) => [
      slot,
      candidatesBySlot[slot].filter((candidate) => candidate.setId === preferredSetId),
    ]));

    if (!SLOTS.some((slot) => preferredBySlot[slot].length)) return null;
    for (const offPieceSlot of SLOTS) {
      const offPieceCandidates = candidatesBySlot[offPieceSlot]
        .filter((candidate) => candidate.setId !== preferredSetId);
      const slotCandidates = Object.fromEntries(SLOTS.map((slot) => [
        slot,
        slot === offPieceSlot
          ? (offPieceCandidates.length ? offPieceCandidates : preferredBySlot[slot])
          : preferredBySlot[slot],
      ]));
      if (SLOTS.some((slot) => !slotCandidates[slot].length)) continue;
      let beam = [{ items: [], score: 0, setCounts: {} }];
      SLOTS.forEach((slot) => {
        const next = [];
        for (const state of beam) {
          for (const candidate of slotCandidates[slot]) {
            if (state.items.some((item) => item.entry.id === candidate.entry.id)) continue;
            const count = (state.setCounts[candidate.setId] || 0) + 1;
            const setCounts = { ...state.setCounts, [candidate.setId]: count };
            let score = state.score + candidate.baseScore;
            if (count === 2) score += candidate.set2Score;
            if (count === 4) score += candidate.set4Score;
            const items = [...state.items, candidate];
            next.push({
              items,
              score,
              setCounts,
              rankScore: score + artifactCritRateCorrection(
                items,
                character,
                role,
                critRateScale,
                weapon,
                team,
              ),
            });
          }
        }
        beam = next
          .sort((a, b) => b.rankScore - a.rankScore)
          .slice(0, 180);
      });
      const candidateBuild = beam
        .map((state) => ({
          ...state,
          score: state.score + artifactCritRateCorrection(
            state.items,
            character,
            role,
            critRateScale,
            weapon,
            team,
          ),
        }))
        .sort((a, b) => b.score - a.score)[0];
      if (candidateBuild && (!best || candidateBuild.score > best.score)) {
        best = {
          items: candidateBuild.items,
          score: candidateBuild.score,
          setCounts: candidateBuild.setCounts,
          preferredSetMet: true,
        };
      }
    }
  } else {
    let beam = [{ items: [], score: 0, setCounts: {} }];
    SLOTS.forEach((slot, index) => {
      const next = [];
      for (const state of beam) {
        for (const candidate of candidatesBySlot[slot]) {
          if (state.items.some((item) => item.entry.id === candidate.entry.id)) continue;
          const count = (state.setCounts[candidate.setId] || 0) + 1;
          const setCounts = { ...state.setCounts, [candidate.setId]: count };
          let score = state.score + candidate.baseScore;
          if (count === 2) score += candidate.set2Score;
          if (count === 4) score += candidate.set4Score;
          next.push({ items: [...state.items, candidate], score, setCounts });
        }
      }
      const slotsRemaining = SLOTS.length - index - 1;
      beam = next
        .map((state) => {
          let potential = 0;
          Object.entries(state.setCounts).forEach(([setId, count]) => {
            const matching = candidatesBySlot[slot].find((candidate) => candidate.setId === setId);
            if (!matching) return;
            if (count === 1 && slotsRemaining >= 1) potential += matching.set2Score * 0.8;
            if (count >= 2 && count < 4 && slotsRemaining >= 4 - count) {
              potential += matching.set4Score * 0.8;
            }
          });
          return {
            ...state,
            rankScore: state.score + potential +
              artifactCritRateCorrection(
                state.items,
                character,
                role,
                critRateScale,
                weapon,
                team,
              ),
          };
        })
        .sort((a, b) => b.rankScore - a.rankScore)
        .slice(0, 180);
    });
    best = beam
      .map((state) => ({
        ...state,
        score: state.score +
          artifactCritRateCorrection(
            state.items,
            character,
            role,
            critRateScale,
            weapon,
            team,
          ),
      }))
      .sort((a, b) => b.score - a.score)[0];
  }
  if (!best) return null;
  const setGroups = Object.entries(best.setCounts)
    .map(([setId, count]) => ({
      setId,
      setName: best.items.find((item) => item.setId === setId)?.setName || "Unknown set",
      count,
    }))
    .sort((a, b) => b.count - a.count);
  const selectedSet = Object.entries(best.setCounts)
    .sort(([, a], [, b]) => b - a)[0];
  const setName = selectedSet
    ? best.items.find((item) => item.setId === selectedSet[0])?.setName
    : "";
  return {
    character,
    role,
    score: best.score,
    preferredSetMet: best.preferredSetMet,
    items: best.items,
    setName,
    setCount: selectedSet?.[1] || 0,
    setGroups,
  };
}

function weaponScore(weapon, role) {
  const stat = String(weapon.mainStat || "").toLowerCase();
  let secondary = 0;
  if (stat.includes("crit")) secondary = role === "support" ? 1 : 10;
  else if (stat.includes("energy recharge")) secondary = role === "support" || role === "offField" ? 8 : 3;
  else if (stat.includes("elemental mastery")) secondary = role === "reaction" ? 10 : 2;
  else if (stat.includes("hp")) secondary = role === "support" ? 6 : 1;
  else if (stat.includes("atk")) secondary = role === "dps" || role === "offField" ? 5 : 3;
  const effect = `${weapon.effectTemplate || ""} ${weapon.effectName || ""}`;
  if (/party|nearby|all party/i.test(effect)) secondary += 2;
  return (weapon.baseAttack || 0) * 0.08 + secondary + (weapon.rarity || 0) * 0.3;
}

export function optimizeTeam(teamSlots, inventory, catalogs) {
  const selected = teamSlots.flatMap((slot, index) => {
    const character = catalogs.characters.find((item) => String(item.id) === String(slot.characterId));
    return character ? [{ ...slot, character, index }] : [];
  });
  const explicitWeaponIds = new Set(teamSlots.map((slot) => slot.weaponId).filter(Boolean));
  const assignedWeapons = new Set();
  const weaponsByIndex = new Map();
  const order = [...selected].sort((a, b) =>
    (ROLE_PRIORITY[a.role] ?? 4) - (ROLE_PRIORITY[b.role] ?? 4));
  order.forEach((member) => {
    const compatible = catalogs.weapons.filter(
      (weapon) => weapon.weaponType === member.character.weaponType,
    );
    const automaticWeapon = compatible
      .filter((weapon) =>
        !assignedWeapons.has(String(weapon.id)) &&
        !explicitWeaponIds.has(String(weapon.id)))
      .sort((a, b) =>
        weaponScore(b, member.role) -
        weaponScore(a, member.role))[0];
    const chosen = (member.weaponId &&
      compatible.find((weapon) => String(weapon.id) === member.weaponId)) || automaticWeapon;
    if (chosen && !assignedWeapons.has(String(chosen.id))) {
      weaponsByIndex.set(member.index, chosen);
      assignedWeapons.add(String(chosen.id));
    }
  });

  const teamContext = selected.map((member) => ({
    id: member.character.id,
    character: member.character,
    role: member.role,
    weapon: weaponsByIndex.get(member.index) || null,
  }));
  const assignedArtifacts = new Set();
  const builds = new Map();
  order.forEach((member) => {
    const build = buildForCharacter(
      member.character,
      member.role,
      member.setId,
      weaponsByIndex.get(member.index),
      teamContext,
      inventory.artifacts,
      catalogs,
      assignedArtifacts,
    );
    if (build) {
      build.index = member.index;
      build.items.forEach((item) => assignedArtifacts.add(item.entry.id));
    }
    builds.set(member.index, build);
  });
  return { builds, weaponsByIndex, selectedCount: selected.length };
}

export function readTeamPresets() {
  try {
    const saved = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!saved) return { presets: [], error: "" };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some((preset) =>
      !isRecord(preset) ||
      typeof preset.id !== "string" ||
      typeof preset.name !== "string" ||
      !Array.isArray(preset.team) ||
      preset.team.length !== 4 ||
      preset.team.some((member) =>
        !isRecord(member) ||
        typeof member.characterId !== "string" ||
        !["dps", "offField", "support", "reaction"].includes(member.role) ||
        typeof member.weaponId !== "string" ||
        typeof member.setId !== "string"))) {
      throw new Error("Saved team presets have an unsupported format.");
    }
    return { presets: parsed, error: "" };
  } catch (error) {
    return {
      presets: [],
      error: `Could not read saved team presets: ${
        error instanceof Error ? error.message : "browser storage is unavailable."
      }`,
    };
  }
}

export function saveTeamPresets(presets) {
  window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

export function makeTeamPresetId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const TEAM_ROLES = [
  ["dps", "On-field DPS"],
  ["offField", "Off-field damage"],
  ["reaction", "Reaction trigger"],
  ["support", "Support"],
];
