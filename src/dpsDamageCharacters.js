import * as arlecchino from "./dpsDamage/characters/arlecchino.js";
import * as raidenShogun from "./dpsDamage/characters/raiden.js";

const CHARACTER_DAMAGE_RULES = {
  Arlecchino: arlecchino,
  "Raiden Shogun": raidenShogun,
};

function getCharacterRules(character) {
  return CHARACTER_DAMAGE_RULES[character.name];
}

export function isCharacterNormalAttack(character, talentAction) {
  return getCharacterRules(character)?.isNormalAttack(character, talentAction) || false;
}

export function getCharacterDamageDetails(options) {
  const rules = getCharacterRules(options.character);
  if (rules) return rules.getDamageDetails(options);
  return {
    scalingValue: null,
    arlecchinoNormal: false,
    masqueActive: false,
    masqueExtra: 0,
    damageElement: options.character.element,
    passiveDamageBonus: 0,
  };
}
