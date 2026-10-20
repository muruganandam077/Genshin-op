export const STELLAR_SYSTEM = {
  reaction: {
    name: "Stellar-Conduct",
    replaces: "Superconduct",
    trigger: ["Cryo", "Electro"],
    enablers: ["Sandrone", "Cryo Traveler", "Odette"],
    damageFormula: "High-scaling ATK and Elemental Mastery",
    canCrit: true,
    resistanceShred: {
      Physical: 40,
      Cryo: 15,
      Electro: 15,
    },
  },
  polestarField: {
    name: "Starlight Prism Arena",
    durationSeconds: 6,
    refreshesOnStellarConduct: true,
    partyDamageBonuses: {
      Cryo: 20,
      Electro: 20,
    },
    maxStacks: 10,
    stackTrigger: "Cryo or Electro damage hits inside the field",
    novaIntervalSeconds: 4,
    novaDamage: "Proportional to accumulated Polestar stacks",
  },
  radiance: {
    name: "Radiance: Stellar-Conduct",
    effect: "Designated characters inside the Polestar Field unlock transformed kit mechanics and scaling",
  },
};
