import character from "../../characters/Beidou.json";

export function getCombatEffects({ constellation = 0, inPolestarField = false }) {
  return {
    resistanceShredOverrides: constellation >= 6 && inPolestarField
      ? { electro: 20, physical: 20 }
      : {},
  };
}

export default {
  ...character,
  stellar: {
    title: "Radiance: Thunderbeast Cleaver",
    role: "Stellar Electro Sub-DPS & Shielder",
    baseKit: [
      "Stormbreaker's chain lightning bounce limit increases from 3 (or 5 at C2) to 7 targets, jumping across the entire Polestar Field without distance decay.",
      "Landing a perfect parry with Tidecaller immediately awards the field maximum Polestar stacks (10).",
      "Triggering Stellar-Conduct while Stormbreaker is active reduces Burst cooldown by 1s and refunds 3 Energy.",
    ],
    constellations: [
      {
        level: 1,
        name: "Sea Beast's Scourge",
        effects: [
          "Shield absorption increases to 22% Max HP with 250% absorption against Electro DMG, granting 15% interruption resistance to all allies.",
        ],
      },
      {
        level: 2,
        name: "Upon the Turbulent Sea",
        effects: ["Arc lightning jumps to 4 additional targets (up to 7 total) across the entire field."],
      },
      { level: 3, name: "Summoner of Storm", effects: ["Skill Level +3."] },
      {
        level: 4,
        name: "Stunning Revenge",
        effects: [
          "Normal attacks deal an additional 30% Electro DMG on hit and count as Elemental Skill damage.",
        ],
      },
      { level: 5, name: "Crimson Tidewalker", effects: ["Burst Level +3."] },
      {
        level: 6,
        name: "Bane of Evil",
        effects: [
          "Shred increases to 20% Electro and Physical RES.",
          "Triggering Stellar-Conduct refunds 3 Energy.",
        ],
      },
    ],
    getCombatEffects,
  },
};
