import { getDamageBonusBreakdown } from "./dpsDamageBonuses.js";
import {
  getCharacterDamageDetails,
  isCharacterNormalAttack,
} from "./dpsDamageCharacters.js";
import { applyReactionDamage } from "./dpsDamageReactions.js";
import { getTalentMultiplier } from "./dpsDamageTalents.js";
import { getWeaponDamageBonus } from "./dpsDamageWeapons.js";

export { getTalentMultiplier } from "./dpsDamageTalents.js";

export function isArlecchinoNormalAttack(character, talentAction) {
  return character.name === "Arlecchino" &&
    isCharacterNormalAttack(character, talentAction);
}

export function calculateActionDamage(
  stats,
  action,
  character,
  talentAction,
  level,
  enemyLevel,
  resistance,
  {
    bondOfLifePercent = 0,
    constellation = 0,
    supportDamageBonuses = {},
    weaponDamageBonuses = {},
    selfDamageBonus = 0,
    burstDamageBonus = 0,
    resistanceShredByElement = {},
  } = {},
) {
  const multiplier = getTalentMultiplier(character, talentAction, level);
  const characterDamage = getCharacterDamageDetails({
    character,
    talentAction,
    stats,
    level,
    bondOfLifePercent,
    constellation,
  });
  const scalingValue = characterDamage.scalingValue ?? ({
    atk: stats.attack,
    hp: stats.hp,
    def: stats.defense,
    eleMas: stats.elementalMastery,
  }[action.scaling] || 0);
  const talentBaseDamage = scalingValue * multiplier;
  const baseDamage = talentBaseDamage + characterDamage.masqueExtra;
  const critDamage = Math.max(0, stats.critDamage) / 100;
  const defenseMultiplier = (90 + 100) / (90 + 100 + enemyLevel + 100);
  const damageElement = characterDamage.damageElement;
  const resistanceShred = resistanceShredByElement[damageElement.toLowerCase()] || 0;
  const resistanceRatio = (resistance - resistanceShred) / 100;
  const resistanceMultiplier = resistanceRatio < 0
    ? 1 - resistanceRatio / 2
    : resistanceRatio <= 0.75
      ? 1 - resistanceRatio
      : 1 / (4 * resistanceRatio + 1);
  const {
    weaponDamageBonus,
    physicalWeaponDamageBonus,
  } = getWeaponDamageBonus({
    weaponDamageBonuses,
    damageElement,
    talentAction,
    arlecchinoNormal: characterDamage.arlecchinoNormal,
    character,
  });
  const damageBonusBreakdown = getDamageBonusBreakdown({
    character,
    damageElement,
    stats,
    supportDamageBonuses,
    selfDamageBonus,
    burstDamageBonus,
    weaponDamageBonus,
    physicalWeaponDamageBonus,
    passiveDamageBonus: characterDamage.passiveDamageBonus,
  });
  const damageBonus = Object.values(damageBonusBreakdown)
    .reduce((total, value) => total + value, 0);
  const nonCritMultiplier = (1 + damageBonus / 100) *
    defenseMultiplier * resistanceMultiplier;
  const initialNonCritDamage = baseDamage * nonCritMultiplier;
  const initialCritDamage = initialNonCritDamage * (1 + critDamage);
  const {
    nonCritDamage,
    critDamageValue,
  } = applyReactionDamage({
    action,
    damageElement,
    stats,
    resistanceMultiplier,
    nonCritMultiplier,
    critDamage,
    nonCritDamage: initialNonCritDamage,
    critDamageValue: initialCritDamage,
  });

  return {
    damage: critDamageValue,
    nonCritDamage,
    critDamage: critDamageValue,
    multiplier,
    damageElement,
    damageBonus,
    damageBonusBreakdown,
    weaponDamageBonus,
    resistanceShred,
    effectiveResistance: resistance - resistanceShred,
    masqueExtra: characterDamage.masqueExtra,
    talentBaseDamage,
    masqueActive: characterDamage.masqueActive,
  };
}
