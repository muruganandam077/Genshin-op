import character from "../../characters/Cyno.json";

export function getCombatEffects({ constellation = 0, isSelf = false }) {
  return {
    stellarCritDamageBonus: isSelf && constellation >= 6 ? 50 : 0,
  };
}

export default {
  ...character,
  stellar: {
    title: "Radiance: Jackal's Stellar Judgment",
    role: "Stellar Electro Main DPS",
    baseKit: [
      "Inside the Polestar Field, Secret Rite: Chasmic Soulfarer can be cast to enter Pactsworn Pathclearer directly without consuming 80 Burst energy.",
      "Gains additional Electro DMG equal to 0.15% of his Elemental Mastery per Polestar stack, up to +75% Electro DMG.",
      "Endseer intervals trigger every 3s instead of 4s, synchronize with Polestar Nova pulses, and deal guaranteed Critical Hits.",
    ],
    constellations: [
      {
        level: 1,
        name: "Ordnance: Overseeing Metering",
        effects: [
          "Normal ATK SPD +25% for 12s.",
          "Entering Pactsworn Pathclearer under Radiance grants Protection of Anubis, providing a major team-transferable Elemental Mastery bonus.",
        ],
      },
      {
        level: 2,
        name: "Ceremony: Homecoming of Spirits",
        effects: [
          "Electro DMG Bonus increases by 12% per hit, up to 60%.",
          "Teammates benefiting from his buffs gain an increased Stellar-Conduct DMG Bonus for the duration of the Polestar Field.",
        ],
      },
      { level: 3, name: "Precept: Lawful Enforcer", effects: ["Burst Level +3."] },
      {
        level: 4,
        name: "Austerity: Forbidding Guard",
        effects: [
          "Triggering reactions in Burst or Radiance restores 4 Energy per reaction, up to 20 Energy total, to all party members including Cyno.",
        ],
      },
      {
        level: 5,
        name: "Funerary Rite: The Passing of Starlight",
        effects: ["Skill Level +3."],
      },
      {
        level: 6,
        name: "Raiment: Just Scales",
        effects: [
          "Dayfly stacks increase to 6.",
          "Duststalker Bolts deal 130% ATK damage with massive EM-to-damage conversions and +50% reaction Crit DMG.",
        ],
      },
    ],
    getCombatEffects,
  },
};
