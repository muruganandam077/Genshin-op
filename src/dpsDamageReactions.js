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
