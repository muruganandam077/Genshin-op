import character from "../../characters/Yae Miko.json";

export function getCombatEffects({
  constellation = 0,
  isSelf = false,
  isActiveCharacter = false,
  totemsActive = false,
}) {
  return {
    stellarCritDamageBonus: isSelf && constellation >= 6 ? 200 : 0,
    elementalMasteryBonus: constellation >= 2 && totemsActive &&
      (isSelf || isActiveCharacter)
      ? 200
      : 0,
  };
}

export function getTriggeredBuffs({ constellation = 0, trigger }) {
  if (constellation < 1 || trigger !== "stellarConduct") return [];
  return [
    {
      source: "Yae Miko C1 · Yakan Offering",
      stat: "stellarConductDamageBonus",
      value: 50,
      duration: 10,
      stackGroup: "yae-miko-stellar-conduct",
    },
    {
      source: "Yae Miko C1 · Yakan Offering",
      stat: "electroDamageBonus",
      value: 50,
      duration: 10,
      stackGroup: "yae-miko-stellar-electro",
    },
  ];
}

export default {
  ...character,
  stellar: {
    title: "Radiance: Fox-Fire Polestar",
    role: "Stellar Electro Off-Field Sub-DPS & Buffer",
    baseKit: [
      "Sesshou Sakura lightning strikes inside the Polestar Field trigger bonus Stellar-Conduct discharges dealing 85% ATK + 150% EM damage.",
      "Holding Yakan Evocation: Sesshou Sakura instantly summons all 3 Level 3 totems simultaneously in a triangular formation.",
      "Great Secret Art: Tenko Kenshin consumes Polestar stacks to increase Tenko Thunderbolt damage by 20% per stack without destroying active totems.",
    ],
    constellations: [
      {
        level: 1,
        name: "Yakan Offering",
        effects: [
          "Recovers 10 Elemental Energy per thunderbolt, up to 40 Energy total.",
          "After triggering Superconduct/Stellar-Conduct or dealing Stellar-Conduct DMG, nearby party members gain 50% Electro DMG and Stellar-Conduct DMG Bonus for 10s; refreshes upon triggering again.",
        ],
      },
      {
        level: 2,
        name: "Fox's Mooncall",
        effects: [
          "Totems start at Level 2 (maximum Level 4) and have 60% increased range.",
          "Active totems grant Yae Miko and the active character scaling Elemental Mastery bonuses, up to 200 EM.",
        ],
      },
      { level: 3, name: "The Seven Glamours", effects: ["Skill Level +3."] },
      {
        level: 4,
        name: "Sakura Channeling",
        effects: [
          "Totem lightning strikes increase party-wide Electro DMG by 20% for 5s and provide flat energy recovery.",
          "Yae Miko's Elemental Burst DMG receives a flat +100% boost.",
        ],
      },
      { level: 5, name: "Mischievous Teasing", effects: ["Burst Level +3."] },
      {
        level: 6,
        name: "Forbidden Art: Daisesshou",
        effects: [
          "Totem attacks ignore 60% of opponent's DEF.",
          "Stellar-Conduct DMG gains +200% Crit DMG.",
        ],
      },
    ],
    getCombatEffects,
    getTriggeredBuffs,
  },
};
