import { getDamageBonusBreakdown } from "./dpsDamageBonuses.js";
import {
  getCharacterDamageDetails,
  isCharacterNormalAttack,
} from "./dpsDamageCharacters.js";
import {
  applyReactionDamage,
  calculateStellarConductDamage,
} from "./dpsDamageReactions.js";
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
    stellarDamageBonus = 0,
    stellarCritRateBonus = 0,
    stellarCritDamageBonus = 0,
    critDamageBonus = 0,
    polestarStacks = 0,
    enemyDefenseReduction = 0,
    enemyDamageTakenBonus = 0,
    damageElementOverride = null,
    stellarBaseDamageBonus = 0,
    talentMultiplierOverride = null,
  } = {},
) {
  const multiplier = talentMultiplierOverride ??
    getTalentMultiplier(
      character,
      { ...talentAction, reaction: action.reaction },
      level,
    );
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
  const isDirectStellarConductAction = action.reaction === "stellarConduct" &&
    /Stellar-Conduct/i.test(talentAction.name);
  const baseDamage = isDirectStellarConductAction
    ? 0
    : talentBaseDamage + characterDamage.masqueExtra;
  const critDamage = (Math.max(0, stats.critDamage) + critDamageBonus) / 100;
  const defenseMultiplier = (90 + 100) / (90 + 100 + enemyLevel + 100);
  const damageElement = damageElementOverride || characterDamage.damageElement;
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
  const enemyDamageTakenMultiplier = 1 + enemyDamageTakenBonus / 100;
  const initialNonCritDamage = baseDamage * nonCritMultiplier * enemyDamageTakenMultiplier;
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
  const stellarConduct = action.reaction === "stellarConduct" &&
    ["Cryo", "Electro"].includes(damageElement)
    ? calculateStellarConductDamage({
      baseDamage: talentBaseDamage,
      stats,
      characterLevel: stats.baseLevel || 90,
      enemyLevel,
      enemyResistance: resistance,
      resistanceShred: resistanceShredByElement[damageElement.toLowerCase()] || 0,
      defenseReduction: enemyDefenseReduction,
      stellarDamageBonus,
      damageBonus,
      stellarCritRateBonus,
      stellarCritDamageBonus: stellarCritDamageBonus + critDamageBonus,
      enemyDamageTakenBonus,
      polestarStacks,
      independentDamageMultiplier: character.name === "Odette"
        ? 1 + Math.min(0.3, 0.015 * Math.max(0, stats.attack - 1000) / 100)
        : 1,
      baseDamageBonus: stellarBaseDamageBonus,
    })
    : null;
  const stellarCritDamage = stellarConduct?.critDamage || 0;
  const stellarNonCritDamage = stellarConduct?.nonCritDamage || 0;

  return {
    damage: critDamageValue + stellarCritDamage,
    nonCritDamage: nonCritDamage + stellarNonCritDamage,
    critDamage: critDamageValue + stellarCritDamage,
    stellarConduct,
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
