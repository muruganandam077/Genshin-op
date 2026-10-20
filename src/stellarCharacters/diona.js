import character from "../../characters/Diona.json";

export function getCombatEffects({ constellation = 0, inPolestarField = false }) {
  return {
    critDamageBonus: constellation >= 6 && inPolestarField ? 15 : 0,
  };
}

export function getTriggeredBuffs({ trigger }) {
  if (trigger !== "burst") return [];
  return [{
    source: "Diona · Stellar Signature Mix",
    stat: "elementalMastery",
    value: 200,
    duration: 12,
    stackGroup: "diona-stellar-em",
  }];
}

export default {
  ...character,
  stellar: {
    title: "Radiance: Kätzlein Starlight Blend",
    role: "Stellar Cryo Shielder & Buffer",
    baseKit: [
      "Icy Paws shield absorption is increased by +35%. While active in the Polestar Field, the shield periodically fires tracking starlight icicles at enemies.",
      "Signature Mix's Drunken Mist field grants +200 Elemental Mastery to all allies and accumulates 1 Polestar stack every second.",
      "Stamina consumption is reduced by 25% and movement speed is increased by 15%.",
    ],
    constellations: [
      {
        level: 1,
        name: "A Lingering Flavor",
        effects: ["Restores 18 Energy to Diona and 6 Energy to all party members after Burst ends."],
      },
      {
        level: 2,
        name: "Tremendous Paws",
        effects: [
          "Shield absorption is increased by +30%; the shield fires tracking starlight icicles inside the field.",
        ],
      },
      { level: 3, name: "A-Another Cup?", effects: ["Burst Level +3."] },
      {
        level: 4,
        name: "Wine Connoisseur",
        effects: [
          "Aimed Shot charge time is reduced by 75%; fully charged shots trigger an extra Icy Paw volley.",
        ],
      },
      { level: 5, name: "Double Shot, On the Rocks", effects: ["Skill Level +3."] },
      {
        level: 6,
        name: "Cat's Tail Closing Time",
        effects: [
          "The +200 EM bonus is active at all HP levels, removing the above-50%-HP restriction.",
          "Grants the party +15% Cryo and Electro Crit DMG inside the Polestar Field.",
        ],
      },
    ],
    getCombatEffects,
    getTriggeredBuffs,
  },
};
