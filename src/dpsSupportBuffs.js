export function getTalentAttributeValue(character, talentName, labelPrefix, level) {
  const talent = (character.combatTalents || []).find((entry) => entry.name === talentName);
  const labelIndex = talent?.attributes?.labels?.findIndex((entry) =>
    entry.startsWith(`${labelPrefix}|`)) ?? -1;
  if (labelIndex < 0) return 0;
  const expression = talent.attributes.labels[labelIndex].split("|")[1] || "";
  const parameter = expression.match(/\{param(\d+):[^}]+\}/);
  if (!parameter) return 0;
  const values = talent.attributes.parameters?.[`param${parameter[1]}`] || [];
  return values[Math.min(Math.max(1, level) - 1, values.length - 1)] || 0;
}

function getRefinementValue(weapon, refinement) {
  const entry = weapon?.refinements?.find((value) => value.rank === refinement);
  return Number.parseFloat(String(entry?.values?.[0] || "")) || 0;
}

export function storeBuff(buffsByTarget, targetIndex, buff) {
  const buffs = buffsByTarget.get(targetIndex) || [];
  buffsByTarget.set(targetIndex, [
    ...buffs.filter((entry) =>
      entry.source !== buff.source &&
      (!buff.stackGroup || entry.stackGroup !== buff.stackGroup)),
    buff,
  ]);
}

export function addStackingBuff(buffsByTarget, targetIndex, buff) {
  const buffs = buffsByTarget.get(targetIndex) || [];
  buffsByTarget.set(targetIndex, [...buffs, buff]);
}

export function getActiveSupportBuffs(buffsByTarget, targetIndex, time) {
  return (buffsByTarget.get(targetIndex) || []).filter((buff) => buff.expiresAt > time);
}

export function activateNoblesseBurst({ member, members, time, buffsByTarget }) {
  if (!member.build?.setGroups?.some((group) => group.count >= 4 &&
      group.setName === "Noblesse Oblige")) return [];
  const events = [];
  members.forEach((target) => {
    storeBuff(buffsByTarget, target.index, {
      source: "Noblesse Oblige · 4-piece",
      stat: "atkPercent",
      value: 20,
      expiresAt: time + 12,
      stackGroup: "noblesse",
    });
    events.push(`${target.character.name} receives +20% ATK from Noblesse Oblige for 12s`);
  });
  return events;
}

export function activateTenacitySkill({
  member,
  members,
  time,
  buffsByTarget,
}) {
  if (!member.build?.setGroups?.some((group) => group.count >= 4 &&
      group.setName === "Tenacity of the Millelith")) return [];
  const events = [];
  members.forEach((target) => {
    storeBuff(buffsByTarget, target.index, {
      source: "Tenacity of the Millelith · 4-piece",
      stat: "atkPercent",
      value: 20,
      expiresAt: time + 3,
      stackGroup: "tenacity",
    });
    storeBuff(buffsByTarget, target.index, {
      source: "Tenacity of the Millelith · Shield Strength",
      stat: "shieldStrength",
      value: 30,
      expiresAt: time + 3,
      stackGroup: "tenacity-shield",
    });
    events.push(`${target.character.name} receives +20% ATK and +30% Shield Strength from Tenacity for 3s`);
  });
  return events;
}

export function activateThrillingTales({
  holder,
  target,
  time,
  buffsByTarget,
  isOnCooldown,
}) {
  if (holder.weapon?.name !== "Thrilling Tales of Dragon Slayers" || isOnCooldown) {
    return { events: [], cooldownEndsAt: null };
  }
  const value = getRefinementValue(holder.weapon, holder.settings.refinement);
  if (!value) return { events: [], cooldownEndsAt: null };
  const duration = 10;
  storeBuff(buffsByTarget, target.index, {
    source: `Thrilling Tales · ${holder.character.name}`,
    stat: "atkPercent",
    value,
    expiresAt: time + duration,
    stackGroup: "thrilling-tales",
  });
  return {
    events: [`${target.character.name} receives +${value}% ATK from Thrilling Tales for ${duration}s`],
    cooldownEndsAt: time + 20,
  };
}
