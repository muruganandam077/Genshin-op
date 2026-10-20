const TRANSFORMATIVE_REACTION_MULTIPLIERS = {
  overload: 2.75,
  electroCharged: 1.2,
  superconduct: 0.5,
  swirl: 0.6,
  hyperbloom: 3,
  burgeon: 3,
};

export function applyReactionDamage({
  action,
  damageElement,
  stats,
  resistanceMultiplier,
  nonCritMultiplier,
  critDamage,
  nonCritDamage,
  critDamageValue,
}) {
  if (damageElement === "Physical") return { nonCritDamage, critDamageValue };

  if (["forwardMelt", "reverseMelt", "forwardVaporize", "reverseVaporize"]
    .includes(action.reaction)) {
    const reactionMultiplier = action.reaction.startsWith("forward") ? 2 : 1.5;
    const amplification = reactionMultiplier *
      (1 + (2.78 * stats.elementalMastery) / (1400 + stats.elementalMastery));
    return {
      nonCritDamage: nonCritDamage * amplification,
      critDamageValue: critDamageValue * amplification,
    };
  }

  const transformativeMultiplier = TRANSFORMATIVE_REACTION_MULTIPLIERS[action.reaction];
  if (transformativeMultiplier) {
    const transformativeDamage = transformativeMultiplier * 1446.85 *
      (1 + (16 * stats.elementalMastery) / (2000 + stats.elementalMastery)) *
      resistanceMultiplier;
    return {
      nonCritDamage: nonCritDamage + transformativeDamage,
      critDamageValue: critDamageValue + transformativeDamage,
    };
  }

  if (action.reaction === "aggravate" || action.reaction === "spread") {
    const multiplier = action.reaction === "aggravate" ? 1.15 : 1.25;
    const additiveDamage = multiplier * 1446.85 *
      (1 + (5 * stats.elementalMastery) / (1200 + stats.elementalMastery)) *
      nonCritMultiplier;
    return {
      nonCritDamage: nonCritDamage + additiveDamage,
      critDamageValue: critDamageValue + additiveDamage * (1 + critDamage),
    };
  }

  return { nonCritDamage, critDamageValue };
}

export function calculateStellarConductDamage({
  baseDamage,
  stats,
  characterLevel = 90,
  enemyLevel,
  enemyResistance,
  resistanceShred = 0,
  defenseReduction = 0,
  stellarDamageBonus = 0,
  stellarCritRateBonus = 0,
  stellarCritDamageBonus = 0,
  enemyDamageTakenBonus = 0,
  polestarStacks = 0,
  damageBonus = 0,
  independentDamageMultiplier = 1,
  baseDamageBonus = 0,
}) {
  const stacks = Math.min(10, Math.max(0, Math.floor(polestarStacks)));
  const elementalMasteryBonus = 6 * Math.max(0, stats.elementalMastery) /
    (Math.max(0, stats.elementalMastery) + 2000);
  const polestarMultiplier = stacks === 0 ? 1 : 1.4 + 0.05 * stacks;
  const defenseMultiplier = (characterLevel + 100) /
    ((characterLevel + 100) + (enemyLevel + 100) *
      (1 - Math.min(100, Math.max(0, defenseReduction)) / 100));
  const effectiveResistance = enemyResistance - resistanceShred;
  const resistanceRatio = effectiveResistance / 100;
  const resistanceMultiplier = resistanceRatio < 0
    ? 1 - resistanceRatio / 2
    : resistanceRatio <= 0.75
      ? 1 - resistanceRatio
      : 1 / (4 * resistanceRatio + 1);
  const nonCritDamage = baseDamage * (1 + baseDamageBonus / 100) *
    (1 + (stellarDamageBonus + damageBonus) / 100 + elementalMasteryBonus) *
    polestarMultiplier * defenseMultiplier * resistanceMultiplier *
    (1 + enemyDamageTakenBonus / 100) * independentDamageMultiplier;
  const critRate = Math.min(
    100,
    Math.max(0, (stats.critRate || 0) + stellarCritRateBonus),
  ) / 100;
  const critDamage = (Math.max(0, stats.critDamage || 0) +
    stellarCritDamageBonus) / 100;
  const critDamageValue = nonCritDamage * (1 + critDamage);

  return {
    nonCritDamage,
    critDamage: critDamageValue,
    averageDamage: nonCritDamage * (1 + critRate * critDamage),
    elementalMasteryBonus: elementalMasteryBonus * 100,
    critRate: critRate * 100,
    stellarDamageBonus,
    damageBonus,
    stellarCritRateBonus,
    stellarCritDamageBonus,
    independentDamageMultiplier,
    baseDamageBonus,
    polestarStacks: stacks,
    polestarMultiplier,
    defenseMultiplier,
    resistanceMultiplier,
    effectiveResistance,
  };
}
