function getTalentSlot(character, talentAction) {
  return character.combatTalents?.[talentAction.talentIndex]?.slot || "";
}

export function getWeaponDamageBonus({
  weaponDamageBonuses,
  damageElement,
  talentAction,
  arlecchinoNormal,
  character,
}) {
  const normalDamageBonus = arlecchinoNormal ? weaponDamageBonuses.normal || 0 : 0;
  const burstDamageBonus = getTalentSlot(character, talentAction) === "combat3"
    ? weaponDamageBonuses.burst || 0
    : 0;
  const weaponDamageBonus = (weaponDamageBonuses.all || 0) +
    (weaponDamageBonuses[damageElement.toLowerCase()] || 0) +
    normalDamageBonus +
    burstDamageBonus;

  return {
    weaponDamageBonus,
    physicalWeaponDamageBonus: (weaponDamageBonuses.all || 0) +
      normalDamageBonus +
      burstDamageBonus,
  };
}
