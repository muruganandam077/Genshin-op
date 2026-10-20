import {
  addStackingBuff,
  getActiveSupportBuffs,
  storeBuff,
} from "../../dpsSupportBuffs.js";

export function isOverloadTeam(members) {
  return members.every((entry) => ["Pyro", "Electro"].includes(entry.character.element)) &&
    members.some((entry) => entry.character.element === "Pyro") &&
    members.some((entry) => entry.character.element === "Electro");
}

export function isSkillAction(character, talentAction) {
  return character.name === "Chevreuse" &&
    character.combatTalents?.[talentAction.talentIndex]?.slot === "combat2";
}

export function shouldFireOverchargedBall({
  character,
  talentAction,
  hasOverloadTeam,
  ballReady,
}) {
  return hasOverloadTeam && ballReady && isSkillAction(character, talentAction);
}

export function applyOverloadEffects({
  reaction,
  damageElement,
  hasOverloadTeam,
  time,
  enemyResistanceShredExpiry,
}) {
  if (reaction !== "overload" || !hasOverloadTeam ||
      !["Pyro", "Electro"].includes(damageElement)) {
    return false;
  }
  enemyResistanceShredExpiry.set("pyro", time + 6);
  enemyResistanceShredExpiry.set("electro", time + 6);
  return true;
}

export function activateOverchargedBall({ member, members, time, buffsByTarget }) {
  const attackBonus = Math.min(40, (member.stats?.hp || 0) / 1000);
  if (attackBonus <= 0) return [];
  const events = [];
  members.filter((target) =>
    ["Pyro", "Electro"].includes(target.character.element)).forEach((target) => {
    storeBuff(buffsByTarget, target.index, {
      source: "Chevreuse · Vertical Force Coordination",
      stat: "atkPercent",
      value: attackBonus,
      expiresAt: time + 30,
      stackGroup: "chevreuse-attack",
    });
    events.push(`${target.character.name} receives +${attackBonus}% ATK from Chevreuse for 30s`);
  });
  return events;
}

export function applyC6Stack({ target, time, buffsByTarget }) {
  const activeStacks = getActiveSupportBuffs(buffsByTarget, target.index, time)
    .filter((buff) => buff.source.startsWith("Chevreuse · C6") &&
      buff.stat === "pyroDamageBonus").length;
  if (activeStacks >= 3) return null;
  const stack = activeStacks + 1;
  const expiresAt = time + 8;
  addStackingBuff(buffsByTarget, target.index, {
    source: `Chevreuse · C6 · Pyro · stack ${stack}`,
    stat: "pyroDamageBonus",
    value: 20,
    expiresAt,
  });
  addStackingBuff(buffsByTarget, target.index, {
    source: `Chevreuse · C6 · Electro · stack ${stack}`,
    stat: "electroDamageBonus",
    value: 20,
    expiresAt,
  });
  return `${target.character.name} gains +20% Pyro/Electro DMG Bonus from Chevreuse C6 (${stack}/3 stacks, 8s)`;
}

export function createHealingSchedule(member, time) {
  if (member.settings.constellation < 6) return null;
  return {
    chevreuseIndex: member.index,
    nextHealAt: time + 2,
    teamHealAt: time + 12,
    teamHealApplied: false,
  };
}

export function applyInitialHeal({ member, time, buffsByTarget }) {
  if (member.settings.constellation < 6) return null;
  return applyC6Stack({ target: member, time, buffsByTarget });
}

export function processHealing({
  schedules,
  members,
  time,
  activeMemberIndex,
  previousActionMemberIndex,
  buffsByTarget,
  onHeal,
}) {
  const effects = [];
  const applyStack = (targetIndex, healTime, description) => {
    const target = members.find((entry) => entry.index === targetIndex);
    if (!target) return;
    onHeal?.(target, healTime);
    const effect = applyC6Stack({ target, time: healTime, buffsByTarget });
    if (effect) effects.push(`${effect} ${description}`);
  };

  for (const schedule of schedules) {
    while (schedule.nextHealAt <= time && schedule.nextHealAt < schedule.teamHealAt) {
      const recipientIndex = activeMemberIndex ??
        previousActionMemberIndex ??
        schedule.chevreuseIndex;
      applyStack(recipientIndex, schedule.nextHealAt, "after a heal pulse");
      schedule.nextHealAt += 2;
    }
    if (!schedule.teamHealApplied && schedule.teamHealAt <= time) {
      schedule.teamHealApplied = true;
      members.forEach((target) => applyStack(
        target.index,
        schedule.teamHealAt,
        "from Chevreuse's delayed team heal",
      ));
    }
  }
  return effects;
}
