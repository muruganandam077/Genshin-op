export function getHitEffects({ member, values, time, state }) {
  const stacks = (state.silverLightStacks.get(member.index) || [])
    .filter((expiry) => expiry > time).length;
  return {
    attackPercent: 0,
    flatAttack: 0,
    elementalMastery: stacks * values[0],
    damageBonuses: {},
    entries: [{
      source: "Silver Light",
      description: `+${stacks * values[0]} Elemental Mastery from ${stacks}/2 Skill-use stack(s)`,
      applied: stacks > 0,
      modeled: true,
    }],
  };
}

export function recordHit(member, talentAction, time, state) {
  if (member.character.combatTalents?.[talentAction.talentIndex]?.slot !== "combat2") {
    return;
  }
  const stacks = (state.silverLightStacks.get(member.index) || [])
    .filter((expiry) => expiry > time);
  if (stacks.length < 2) stacks.push(time + 12);
  state.silverLightStacks.set(member.index, stacks);
}
