import character from "../../characters/Odette.json";

export function getCombatEffects({
  constellation = 0,
  inPolestarField = false,
  isSelf = false,
}) {
  const resistanceShredByElement = {};
  if (constellation >= 2 && inPolestarField) {
    resistanceShredByElement.cryo = 20;
    resistanceShredByElement.electro = 20;
  }
  return {
    resistanceShredByElement,
    stellarDamageBonus: isSelf && constellation >= 6 && inPolestarField ? 20 : 0,
  };
}

export function getTriggeredBuffs({ constellation = 0, trigger }) {
  if (constellation < 6 || trigger !== "burst") return [];
  return [{
    source: "Odette C6 · Put Out My Hand, and Touched the Face of the Divine",
    stat: "stellarConductDamageBonus",
    value: 25,
    duration: 15,
    stackGroup: "odette-c6-stellar-damage",
  }];
}

export default {
  ...character,
  stellar: {
    role: "Stellar-Conduct Enabler",
    baseKit: [
      "Qualifies as a Stellar Glimmer enabler for triggering Stellar-Conduct when the party applies Cryo and Electro.",
    ],
    constellations: [],
    getCombatEffects,
    getTriggeredBuffs,
  },
};
