import character from "../../characters/Qiqi.json";

export function getCombatEffects({
  constellation = 0,
  inPolestarField = false,
  normalOrChargedAttack = false,
  isSelf = false,
}) {
  const cryoInfusion = isSelf && constellation >= 2 &&
    inPolestarField && normalOrChargedAttack;
  return {
    cryoInfusion,
    selfDamageBonus: cryoInfusion ? 30 : 0,
  };
}

export function getTriggeredBuffs({ constellation = 0, trigger }) {
  if (trigger !== "burst") return [];
  const buffs = [];
  if (constellation >= 4) {
    buffs.push({
      source: "Qiqi C4 · Divine Suppression",
      stat: "enemyDamageTakenBonus",
      value: 20,
      duration: 15,
      stackGroup: "qiqi-c4-damage-taken",
    });
  }
  if (constellation >= 6) {
    buffs.push({
      source: "Qiqi C6 · Rite of Resurrection",
      stat: "allDamageBonus",
      value: 30,
      duration: 15,
      stackGroup: "qiqi-c6-all-damage",
    });
    buffs.push({
      source: "Qiqi C6 · Rite of Resurrection",
      stat: "stellarConductDamageBonus",
      value: 30,
      duration: 15,
      stackGroup: "qiqi-c6-stellar-damage",
    });
  }
  return buffs;
}

export default {
  ...character,
  stellar: {
    title: "Radiance: Fortune-Preserving Talisman",
    role: "Stellar Cryo Healer & Sub-DPS",
    baseKit: [
      "Hitting enemies marked by Fortune-Preserving Talismans inside the Polestar Field generates 2 Cryo particles every 3.5s.",
      "100% of overflow healing converts into Glacial Burst AoE damage, dealing up to 35,000 damage every 3 seconds.",
      "Herald of Frost pulse frequency is increased by 50% for rapid off-field Cryo application.",
    ],
    constellations: [
      {
        level: 1,
        name: "Ascetics of Frost",
        effects: [
          "Regenerates 3.5 Energy for Qiqi and 1.5 Energy for the active ally.",
          "Marked enemies generate 2 Cryo particles every 3.5s.",
        ],
      },
      {
        level: 2,
        name: "Frozen to the Bone",
        effects: [
          "Normal and Charged Attack DMG against Cryo-affected enemies increases to 30% (up from 15%).",
          "Attacks gain Cryo Infusion and +15% ATK SPD in the Polestar Field.",
        ],
      },
      { level: 3, name: "Ascendant Praise", effects: ["Burst Level +3."] },
      {
        level: 4,
        name: "Divine Suppression",
        effects: [
          "Target ATK reduction increases to 25%; targets take +20% Physical, Cryo, and Electro damage.",
        ],
      },
      { level: 5, name: "Crimson Lotus Bloom", effects: ["Skill Level +3."] },
      {
        level: 6,
        name: "Rite of Resurrection",
        effects: [
          "Revives with 100% HP on a 10-minute cooldown.",
          "If no allies are fallen, casting Burst grants the party +30% All Elemental and Physical DMG for 15s.",
        ],
      },
    ],
    getCombatEffects,
    getTriggeredBuffs,
  },
};
