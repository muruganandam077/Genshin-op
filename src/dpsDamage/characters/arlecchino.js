import { getTalentMultiplier } from "../../dpsDamageTalents.js";

function isArlecchino(character) {
  return character.name === "Arlecchino";
}

export function isNormalAttack(character, talentAction) {
  return isArlecchino(character) &&
    talentAction.talentName === "Invitation to a Beheading" &&
    /^\d+-Hit DMG$/i.test(talentAction.name);
}

function isMasqueAttack(character, talentAction) {
  return isArlecchino(character) &&
    talentAction.talentName === "Invitation to a Beheading" &&
    (/^\d+-Hit DMG$/i.test(talentAction.name) ||
      /^(Charged Attack DMG|Plunge DMG|Low\/High Plunge DMG)$/i.test(talentAction.name));
}

function getMasqueMultiplier(character, level) {
  const talentIndex = (character.combatTalents || []).findIndex(
    (talent) => talent.name === "Invitation to a Beheading",
  );
  if (talentIndex < 0) return 0;
  const attributeIndex = character.combatTalents[talentIndex].attributes?.labels?.findIndex(
    (entry) => entry.startsWith("Masque of the Red Death Increase|"),
  ) ?? -1;
  if (attributeIndex < 0) return 0;
  return getTalentMultiplier(character, { talentIndex, attributeIndex }, level);
}

export function getDamageDetails({
  character,
  talentAction,
  stats,
  level,
  bondOfLifePercent,
  constellation,
}) {
  const arlecchinoNormal = isNormalAttack(character, talentAction);
  const masqueActive = arlecchinoNormal && bondOfLifePercent >= 30;
  const masqueExtra = masqueActive
    ? stats.attack * (
      getMasqueMultiplier(character, level) + (constellation >= 1 ? 1 : 0)
    ) * (bondOfLifePercent / 100)
    : 0;
  const damageElement = isMasqueAttack(character, talentAction)
    ? bondOfLifePercent >= 30 ? "Pyro" : "Physical"
    : character.element;

  return {
    scalingValue: stats.attack,
    arlecchinoNormal,
    masqueActive,
    masqueExtra,
    damageElement,
    passiveDamageBonus: damageElement === "Pyro" ? 40 : 0,
  };
}
