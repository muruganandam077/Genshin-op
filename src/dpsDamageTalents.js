export function getTalentMultiplier(character, action, level = 10) {
  const talent = character.combatTalents?.[action.talentIndex];
  const label = talent?.attributes?.labels?.[action.attributeIndex] || "";
  const [name, rawExpression = ""] = label.split("|");
  const expression = /Stellar-Conduct\/Stellar Swirl/i.test(name)
    ? rawExpression.split("/")[action.reaction === "stellarSwirl" ? 1 : 0]
    : rawExpression;
  const parameters = talent?.attributes?.parameters || {};
  return [...expression.matchAll(/\{param(\d+):[^}]+\}/g)].reduce((total, match) => {
    const values = parameters[`param${match[1]}`] || [];
    const value = values[Math.min(level - 1, values.length - 1)] || 0;
    return total + value;
  }, 0);
}
