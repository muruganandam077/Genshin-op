export function getTalentMultiplier(character, action, level = 10) {
  const talent = character.combatTalents?.[action.talentIndex];
  const expression = talent?.attributes?.labels?.[action.attributeIndex]?.split("|")[1] || "";
  const parameters = talent?.attributes?.parameters || {};
  return [...expression.matchAll(/\{param(\d+):[^}]+\}/g)].reduce((total, match) => {
    const values = parameters[`param${match[1]}`] || [];
    const value = values[Math.min(level - 1, values.length - 1)] || 0;
    return total + value;
  }, 0);
}
