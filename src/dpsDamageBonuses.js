export function getDamageBonusBreakdown({
  character,
  damageElement,
  stats,
  supportDamageBonuses,
  selfDamageBonus,
  burstDamageBonus,
  weaponDamageBonus,
  physicalWeaponDamageBonus,
  passiveDamageBonus,
}) {
  if (character.element === "None") return {};
  if (damageElement === "Physical") {
    return {
      build: stats.physicalDamageBonus,
      support: supportDamageBonuses.physical || 0,
      allDamage: supportDamageBonuses.all || 0,
      selfAndSets: selfDamageBonus,
      burst: burstDamageBonus,
      weapon: physicalWeaponDamageBonus,
    };
  }
  return {
    build: stats.elementalDamageBonus,
    support: supportDamageBonuses[damageElement.toLowerCase()] || 0,
    allDamage: supportDamageBonuses.all || 0,
    selfAndSets: selfDamageBonus,
    burst: burstDamageBonus,
    weapon: weaponDamageBonus,
    characterPassive: passiveDamageBonus,
  };
}
