export function getHitEffects({ member, values, time, state }) {
  const active = (state.tidalShadowExpiresAt.get(member.index) || 0) > time;
  return {
    attackPercent: active ? values[0] : 0,
    flatAttack: 0,
    elementalMastery: 0,
    damageBonuses: {},
    entries: [{
      source: "Tidal Shadow",
      description: active
        ? `+${values[0]}% ATK after being healed`
        : "Triggers for 8s after the wielder is healed",
      applied: active,
      modeled: true,
    }],
  };
}

export function recordHealing(member, time, state) {
  state.tidalShadowExpiresAt.set(member.index, time + 8);
}
