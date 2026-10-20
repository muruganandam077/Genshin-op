import aether from "../../characters/Aether.json";
import lumine from "../../characters/Lumine.json";

function getCryoTravelerVariant(character) {
  return {
    ...character,
    stellarElementalVariant: character.travelerElementalVariants.Cryo,
  };
}

export default {
  name: "Cryo Traveler",
  variants: [
    getCryoTravelerVariant(aether),
    getCryoTravelerVariant(lumine),
  ],
  stellar: {
    title: "Radiance: Starlight Frost",
    role: "Stellar Cryo Enabler & Buffer",
    baseKit: [
      "The skill places an independent Starlight Prism field beacon that sustains the Polestar Field.",
      "The Burst pulls enemies to the field center and shreds 25% Physical and Cryo RES.",
    ],
    constellations: [
      {
        level: 1,
        name: "Frozen Orbit",
        effects: ["Skill duration increases by 3s and grants +15% Cryo DMG."],
      },
      {
        level: 6,
        name: "Stellar Horizon",
        effects: ["Allies standing inside the blizzard gain +40% Stellar-Conduct reaction Crit DMG."],
      },
    ],
  },
};
