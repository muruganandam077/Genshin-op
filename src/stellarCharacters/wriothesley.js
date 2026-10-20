import character from "../../characters/Wriothesley.json";

export default {
  ...character,
  stellar: {
    title: "Radiance: Cerberus Glacial Fist",
    role: "Stellar Cryo Main DPS",
    baseKit: [
      "During Chilling Penalty, Frostbound strikes consume 1 Polestar stack to unleash a Glacial Shatter dealing 140% ATK AoE Cryo damage.",
      "Enhanced Charged Attacks (Rebuke: Vaulting Fist) gain +80% Crit DMG inside the Polestar Field and cost 0 Stamina.",
      "Interruption resistance is upgraded to super-armor level, preventing knockbacks from elite enemies.",
    ],
    constellations: [
      {
        level: 1,
        name: "Terror for the Evildoers",
        effects: [
          "Enhanced Charged Attack deals +60% DMG (up from 50%), costs 0 Stamina, and refunds 10% HP + 5 Energy on hit.",
          "Trigger threshold is loosened to 60% HP or every 5th Normal hit.",
        ],
      },
      {
        level: 2,
        name: "Crescendo of the Shackles",
        effects: [
          "Burst bonus increases to 50% per stack, up to 250%, and triggers a Polestar Starlight Nova shockwave.",
        ],
      },
      { level: 3, name: "Punishment for the Frauds", effects: ["Normal Attack Level +3."] },
      {
        level: 4,
        name: "Redemption for the Suffering",
        effects: [
          "Rebuke healing increases to 25%; overhealing grants the active character +25% ATK SPD and the party +100 EM for 10s.",
        ],
      },
      { level: 5, name: "Mercy for the Wronged", effects: ["Burst Level +3."] },
      {
        level: 6,
        name: "Esteem for the Innocent",
        effects: [
          "Rebuke gains +15% Crit Rate and +100% Crit DMG.",
          "Icicle DMG increases to 150% ATK and is guaranteed to Critical Hit inside the Polestar Field.",
        ],
      },
    ],
  },
};
