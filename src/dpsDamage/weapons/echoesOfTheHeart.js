export function getHitEffects({ member, values, time, state }) {
  const active = (state.echoesOfHeartExpiresAt.get(member.index) || 0) > time;
  return {
    attackPercent: 0,
    flatAttack: 0,
    elementalMastery: active ? values[0] : 0,
    damageBonuses: active ? { stellarConduct: values[1] || 0 } : {},
    entries: [{
      source: "Echoes of the Heart",
      description: active
        ? `+${values[0]} Elemental Mastery and +${values[1] || 0}% Stellar-Conduct DMG`
        : "Triggers for 12s after an Elemental or Stellar-Conduct reaction",
      applied: active,
      modeled: true,
    }],
  };
}

export function recordReaction(member, time, state) {
  state.echoesOfHeartExpiresAt.set(member.index, time + 12);
}
