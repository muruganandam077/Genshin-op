import character from "../../characters/Sandrone.json";

export function getCombatEffects({
  constellation = 0,
  inPolestarField = false,
  isSelf = false,
}) {
  const resistanceShredByElement = {};
  if (constellation >= 1 && inPolestarField) {
    resistanceShredByElement.cryo = 20;
    resistanceShredByElement.electro = 20;
  }
  return {
    critDamageBonus: constellation >= 2 && inPolestarField ? 30 : 0,
    resistanceShredByElement,
    enemyDefenseReduction: isSelf && constellation >= 6 ? 40 : 0,
  };
}

export default {
  ...character,
  stellar: {
    title: "Radiance: Clockwork Marionette",
    role: "Stellar Conduit Enabler & Automaton DPS",
    baseKit: [
      "Automatically transforms party Superconduct into Stellar-Conduct.",
      "The Giant Automaton unleashes coordinated missile volleys whenever Cryo or Electro damage is dealt inside the field.",
      "Automaton strikes extend Polestar Field duration by 1.5s per hit, up to a maximum of 12s.",
    ],
    constellations: [
      {
        level: 1,
        name: "Gears of the Steambird",
        effects: ["Rocket damage increases by 40% and shreds Cryo and Electro RES by 20%."],
      },
      {
        level: 2,
        name: "Perpetual Clockwork Engine",
        effects: ["Grants the party +30% Crit DMG for Cryo and Electro attacks inside the Polestar Field."],
      },
      { level: 3, name: "Mechanism of the Marionette", effects: ["Skill Level +3."] },
      {
        level: 4,
        name: "Iron Curtain Defense",
        effects: ["Party members inside the Polestar Field take 25% reduced damage and are immune to Freeze and stagger."],
      },
      { level: 5, name: "Symphony of Steel", effects: ["Burst Level +3."] },
      {
        level: 6,
        name: "Sovereign of the Automata",
        effects: [
          "Attacks ignore 40% DEF.",
          "Triggers synchronized Starlight Barrages on every reaction.",
        ],
      },
    ],
    getCombatEffects,
  },
};
